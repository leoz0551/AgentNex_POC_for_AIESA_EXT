import streamlit as st
from multimodal_rag_engine import MultimodalRAGEngine
from config import Config
import os
from PIL import Image
import uuid
import re
import shutil

# Page configuration
st.set_page_config(
    page_title="Multimodal AGNO RAG System with Ollama & FAISS",
    page_icon="🖼️",
    layout="wide"
)

@st.cache_resource
def get_rag_engine():
    """Initialize and cache the multimodal RAG engine"""
    engine = MultimodalRAGEngine()
    
    # Try to load existing index, if it doesn't exist we'll create it later
    try:
        engine.load_index()
        st.success("System initialized successfully. Ready to index documents or answer questions.")
    except Exception as e:
        st.info(f"System initializing... Index does not exist yet: {str(e)}. This is normal for first-time setup. Please index documents first.")
    
    return engine

def clear_folders():
    """Clear the contents of imgs and faiss_index folders"""
    try:
        # Clear imgs folder
        if os.path.exists(Config.IMAGES_FOLDER):
            for filename in os.listdir(Config.IMAGES_FOLDER):
                file_path = os.path.join(Config.IMAGES_FOLDER, filename)
                if os.path.isfile(file_path):
                    os.remove(file_path)
                elif os.path.isdir(file_path):
                    shutil.rmtree(file_path)
            st.success(f"Cleared all files from {Config.IMAGES_FOLDER}")
        
        # Clear faiss_index folder
        if os.path.exists(Config.FAISS_INDEX_PATH):
            for filename in os.listdir(Config.FAISS_INDEX_PATH):
                file_path = os.path.join(Config.FAISS_INDEX_PATH, filename)
                if os.path.isfile(file_path):
                    os.remove(file_path)
                elif os.path.isdir(file_path):
                    shutil.rmtree(file_path)
            st.success(f"Cleared all files from {Config.FAISS_INDEX_PATH}")
        
        # Reset the RAG engine
        st.session_state.engine_reset = True
        st.rerun()
        
    except Exception as e:
        st.error(f"Error clearing folders: {str(e)}")

def main():
    st.title("🖼️ Multimodal AGNO RAG System with Ollama & FAISS")
    
    # Initialize RAG engine
    rag_engine = get_rag_engine()
    
    # Sidebar for document indexing
    with st.sidebar:
        st.header("📚 Document & Image Indexing")
        
        # Option to upload documents and images
        uploaded_files = st.file_uploader(
            "Upload documents and images to index",
            type=['txt', 'pdf'] + [ext[1:] for ext in Config.SUPPORTED_IMAGE_FORMATS],
            accept_multiple_files=True
        )
        
        if uploaded_files:
            # Save uploaded files temporarily
            temp_dir = "./temp_docs"
            os.makedirs(temp_dir, exist_ok=True)
            
            file_paths = []
            for uploaded_file in uploaded_files:
                file_ext = os.path.splitext(uploaded_file.name)[1].lower()
                if file_ext in ['.txt', '.pdf'] + Config.SUPPORTED_IMAGE_FORMATS:
                    file_path = os.path.join(temp_dir, uploaded_file.name)
                    with open(file_path, "wb") as f:
                        f.write(uploaded_file.getbuffer())
                    file_paths.append(file_path)
            
            if st.button("Index Uploaded Files"):
                try:
                    with st.spinner("Indexing files..."):
                        for file_path in file_paths:
                            rag_engine.index_documents(file_path)
                            
                        st.success(f"Indexed {len(file_paths)} files successfully!")
                        
                        # Clean up temp files after indexing
                        for file_path in file_paths:
                            os.remove(file_path)
                        os.rmdir(temp_dir)
                        
                        # Reload the index after indexing new documents
                        rag_engine.load_index()
                        
                except Exception as e:
                    st.error(f"Error during indexing: {str(e)}")
        
        # Option to index from a directory
        documents_path = st.text_input(
            "Or enter path to documents directory:",
            placeholder="e.g., ./docs/"
        )
        
        if st.button("Index Files from Directory"):
            if documents_path and os.path.exists(documents_path):
                with st.spinner("Indexing files..."):
                    try:
                        rag_engine.index_documents(documents_path)
                        st.success("Files indexed successfully!")
                        
                        # Reload the index after indexing new documents
                        rag_engine.load_index()
                        
                    except Exception as e:
                        st.error(f"Error during indexing: {str(e)}")
            else:
                st.error("Invalid path or directory does not exist")
        
        # Add button to clear folders
        if st.button("🗑️ Clear All Data", type="secondary"):
            clear_folders()
        
        # Display configuration info
        st.divider()
        st.subheader("⚙️ Configuration")
        st.write(f"Model: `{Config.OLLAMA_MODEL}`")
        st.write(f"Host: `{Config.OLLAMA_HOST}`")
        st.write(f"Chunk Size: `{Config.CHUNK_SIZE}`")
        st.write(f"Top K Results: `{Config.TOP_K_RESULTS}`")
        st.write(f"Supported Images: {', '.join(Config.SUPPORTED_IMAGE_FORMATS)}")
        st.info("💡 Tip: First, upload and index some documents to create the FAISS index. Then you can ask questions about them.")
    
    # Main content area for querying
    st.markdown("### 💬 Ask Questions about Your Documents & Images")
    
    # Check if there are indexed documents available
    has_indexed_content = rag_engine.vectorstore is not None or len(rag_engine.image_store) > 0
    
    if not has_indexed_content:
        st.warning("⚠️ No indexed documents or images found. Please index some documents first before asking questions.")
        user_question = st.text_area(
            "Enter your question:",
            placeholder="Questions can be asked after indexing some documents...",
            height=100,
            disabled=True
        )
    else:
        # Input for user questions with example questions
        st.markdown("**Example questions:** What is mrag1.0? or What is mrag2.0? or What is mrag3.0?")
        user_question = st.text_area(
            "Enter your question:",
            placeholder="What would you like to know about the indexed documents or images?",
            height=100
        )
    
    # Button to submit question
    if st.button("Generate Answer", type="primary") and user_question and has_indexed_content:
        with st.spinner("Generating answer..."):
            try:
                result = rag_engine.query(user_question, include_images=True)
                
                if "error" in result:
                    st.error(result["error"])
                else:
                    # Display the answer with images inserted after paragraphs
                    st.subheader("Answer:")
                    
                    # Process the answer text to replace various image reference formats with images
                    answer_text = result["answer"]
                    
                    # Enhanced regex to catch different possible formats:
                    # 1. <Desc>{number}.png</Desc> - desired format
                    # 2. Figure {number}.png - common mistake
                    # 3. Fig. {number}.png - abbreviated form
                    # 4. 图{number}.png - Chinese format
                    patterns = [
                        (r'<Desc>([^<>]+)</Desc>', '<Desc>'),  # Standard format
                        (r'Figure\s+(\d+)\.png', 'Figure '),   # "Figure 1.png" format
                        (r'Fig\.\s+(\d+)\.png', 'Fig. '),     # "Fig. 1.png" format
                        (r'图(\d+)\.png', '图'),               # "图1.png" format (Chinese)
                    ]
                    
                    # Split the text by sentences/paragraphs to handle them separately
                    # Split by double newlines (paragraphs) or single newlines
                    paragraphs = re.split(r'(\n\s*\n|\n)', answer_text)
                    
                    # Process each paragraph
                    for paragraph in paragraphs:
                        if paragraph.strip() and paragraph not in ['\n', '\n\n']:
                            # Check if this paragraph contains any image references
                            has_image_refs = any(re.search(pattern[0], paragraph) for pattern in patterns)
                            
                            if has_image_refs:
                                # If the paragraph has image refs, process it specially
                                # First, collect all image references and their numbers
                                all_image_refs = []
                                
                                # Process each pattern
                                for pattern, prefix in patterns:
                                    for match in re.finditer(pattern, paragraph):
                                        if pattern.startswith(r'<Desc>'):
                                            img_number = match.group(1).replace('.png', '')
                                        else:
                                            img_number = match.group(1)
                                        
                                        all_image_refs.append({
                                            'full_match': match.group(0),
                                            'img_number': img_number,
                                            'start_pos': match.start(),
                                            'end_pos': match.end()
                                        })
                                
                                # Sort by position to handle them in order
                                all_image_refs.sort(key=lambda x: x['start_pos'])
                                
                                # Process the paragraph without images first
                                last_end = 0
                                clean_paragraph = ""
                                
                                for ref in all_image_refs:
                                    # Add text before the image reference
                                    clean_paragraph += paragraph[last_end:ref['start_pos']]
                                    # Replace the reference with placeholder
                                    clean_paragraph += f"IMAGE_REF_{ref['img_number']}_PLACEHOLDER"
                                    last_end = ref['end_pos']
                                
                                # Add the rest of the paragraph
                                clean_paragraph += paragraph[last_end:]
                                
                                # Display the clean paragraph text
                                if clean_paragraph.strip():
                                    st.write(clean_paragraph)
                                
                                # Then display all images after the paragraph
                                for ref in all_image_refs:
                                    img_number = ref['img_number']
                                    
                                    # Look for the corresponding image in our image store
                                    img_found = False
                                    for img_id, img_meta in rag_engine.image_store.items():
                                        if (img_meta.get("type") == "extracted" and 
                                            img_meta.get("img_number") == img_number):
                                            
                                            img_path = img_meta["path"]
                                            if os.path.exists(img_path):
                                                try:
                                                    image = Image.open(img_path)
                                                    st.image(
                                                        image,
                                                        caption=f"Figure {img_number} from {os.path.basename(img_meta['source_pdf'])}",
                                                        use_column_width=True
                                                    )
                                                    img_found = True
                                                    break
                                                except Exception as e:
                                                    st.error(f"Could not load image {ref['full_match']}: {str(e)}")
                                                    break
                                    
                                    if not img_found:
                                        # If image was not found, note it
                                        st.write(f"[Image {ref['full_match']} not found]")
                            else:
                                # Just display the paragraph as is
                                if paragraph.strip():
                                    st.write(paragraph)
                    
                    # Display sources
                    if result["sources"]:
                        st.subheader("Sources:")
                        for i, source in enumerate(result["sources"], 1):
                            st.write(f"{i}. {source}")
                        
            except Exception as e:
                st.error(f"Error during query: {str(e)}")

    # Instructions
    with st.expander("ℹ️ How to use this Multimodal RAG system"):
        st.markdown("""
        1. **Index content**: Upload documents (PDF, TXT) and images (JPG, PNG, BMP, TIFF) or specify a directory
        2. **Ask questions**: Type your question about the content and click "Generate Answer"
        3. **Review results**: See the AI-generated answer, relevant sources, and related images
        
        Supported formats:
        - Text: PDF, TXT
        - Images: JPG, JPEG, PNG, BMP, TIFF
        
        This system uses:
        - **AGNO Framework**: For application orchestration
        - **Ollama**: To run local LLM (qwen2.5:7b)
        - **FAISS**: For vector storage and similarity search
        - **LangChain**: For document processing and RAG pipeline
        - **Streamlit**: For the interactive UI
        """)

if __name__ == "__main__":
    main()