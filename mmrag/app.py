import streamlit as st
from rag_engine import RAGEngine
from config import Config
import os

# Page configuration
st.set_page_config(
    page_title="AGNO RAG System with Ollama",
    page_icon="🤖",
    layout="wide"
)

@st.cache_resource
def get_rag_engine():
    """Initialize and cache the RAG engine"""
    engine = RAGEngine()
    
    # Try to load existing index, if it doesn't exist we'll create it later
    try:
        engine.load_index()
    except Exception as e:
        st.warning(f"Could not load existing index: {str(e)}. You may need to index documents first.")
    
    return engine

def main():
    st.title("🤖 AGNO RAG System with Ollama (Qwen2.5:7B)")
    
    # Initialize RAG engine
    rag_engine = get_rag_engine()
    
    # Sidebar for document indexing
    with st.sidebar:
        st.header("📚 Document Indexing")
        
        # Option to upload documents
        uploaded_files = st.file_uploader(
            "Upload documents to index",
            type=['txt', 'pdf'],
            accept_multiple_files=True
        )
        
        if uploaded_files:
            # Save uploaded files temporarily
            temp_dir = "./temp_docs"
            os.makedirs(temp_dir, exist_ok=True)
            
            file_paths = []
            for uploaded_file in uploaded_files:
                file_path = os.path.join(temp_dir, uploaded_file.name)
                with open(file_path, "wb") as f:
                    f.write(uploaded_file.getbuffer())
                file_paths.append(file_path)
            
            if st.button("Index Uploaded Documents"):
                try:
                    # Combine all uploaded files into a single temporary directory
                    # For simplicity, we'll index each file separately
                    with st.spinner("Indexing documents..."):
                        for file_path in file_paths:
                            rag_engine.index_documents(file_path)
                            st.success(f"Indexed {uploaded_file.name} successfully!")
                        
                        # Clean up temp files after indexing
                        for file_path in file_paths:
                            os.remove(file_path)
                        os.rmdir(temp_dir)
                        
                except Exception as e:
                    st.error(f"Error during indexing: {str(e)}")
        
        # Option to index from a directory
        documents_path = st.text_input(
            "Or enter path to documents directory:",
            placeholder="e.g., ./docs/"
        )
        
        if st.button("Index Documents from Directory"):
            if documents_path and os.path.exists(documents_path):
                with st.spinner("Indexing documents..."):
                    try:
                        rag_engine.index_documents(documents_path)
                        st.success("Documents indexed successfully!")
                    except Exception as e:
                        st.error(f"Error during indexing: {str(e)}")
            else:
                st.error("Invalid path or directory does not exist")
        
        # Display configuration info
        st.divider()
        st.subheader("⚙️ Configuration")
        st.write(f"Model: `{Config.OLLAMA_MODEL}`")
        st.write(f"Host: `{Config.OLLAMA_HOST}`")
        st.write(f"Chunk Size: `{Config.CHUNK_SIZE}`")
        st.write(f"Top K Results: `{Config.TOP_K_RESULTS}`")
    
    # Main content area for querying
    st.markdown("### 💬 Ask Questions about Your Documents")
    
    # Input for user questions
    user_question = st.text_area(
        "Enter your question:",
        placeholder="What would you like to know about the indexed documents?",
        height=100
    )
    
    # Button to submit question
    if st.button("Generate Answer", type="primary") and user_question:
        with st.spinner("Generating answer..."):
            try:
                result = rag_engine.query(user_question)
                
                if "error" in result:
                    st.error(result["error"])
                else:
                    # Display the answer
                    st.subheader("Answer:")
                    st.write(result["answer"])
                    
                    # Display sources
                    st.subheader("Sources:")
                    for i, source in enumerate(result["sources"], 1):
                        st.write(f"{i}. {source}")
                        
            except Exception as e:
                st.error(f"Error during query: {str(e)}")
    
    # Instructions
    with st.expander("ℹ️ How to use this RAG system"):
        st.markdown("""
        1. **Index documents**: Upload documents or specify a directory containing documents to index
        2. **Ask questions**: Type your question in the input box and click "Generate Answer"
        3. **Review results**: See the AI-generated answer and the sources used
        
        Supported formats: PDF, TXT
        
        This system uses:
        - **AGNO Framework**: For application orchestration
        - **Ollama**: To run local LLM (qwen2.5:7b)
        - **ChromaDB**: For vector storage and similarity search
        - **LangChain**: For document processing and RAG pipeline
        """)

if __name__ == "__main__":
    main()