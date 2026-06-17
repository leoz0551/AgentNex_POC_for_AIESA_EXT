import os
import ollama
from langchain_community.vectorstores import FAISS
from langchain_community.document_loaders import PyPDFLoader, TextLoader, DirectoryLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.embeddings import OllamaEmbeddings
from config import Config
from typing import List, Dict, Any
import logging
from PIL import Image
import numpy as np
import uuid
from pathlib import Path
import fitz  # PyMuPDF
import re
import io

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class MultimodalRAGEngine:
    def __init__(self):
        self.vectorstore = None
        self.embeddings = OllamaEmbeddings(
            model=Config.OLLAMA_MODEL,
            base_url=f"http://{Config.OLLAMA_HOST}"
        )
        self.image_store = {}  # Store image metadata and paths
        os.makedirs(Config.UPLOAD_FOLDER, exist_ok=True)
        os.makedirs(Config.IMAGES_FOLDER, exist_ok=True)  # 确保图片存储目录存在
        os.makedirs(os.path.dirname(Config.FAISS_INDEX_PATH), exist_ok=True)  # 确保FAISS索引目录存在
    
    def extract_images_from_pdf(self, pdf_path: str):
        """
        从PDF文件中提取所有图片并保存到指定目录，使用图片在文档中的编号作为文件名
        :param pdf_path: PDF文件路径
        :return: 提取的图片路径列表
        """
        extracted_images = []
        
        try:
            # 打开PDF文件
            doc = fitz.open(pdf_path)
            
            # 先提取所有的文本内容，寻找图片标题
            all_text = ""
            all_page_texts = []  # 存储每页的文本，用于后续更精确的匹配
            for page_num in range(len(doc)):
                page = doc[page_num]
                page_text = page.get_text()
                all_text += page_text
                all_page_texts.append(page_text)
            
            # 查找图片标题（包含"图*"或"Fig.*"的文本）
            figure_pattern = r'(?:图|Fig\.?)\s*(\d+)'
            figure_matches = re.findall(figure_pattern, all_text)
            logger.info(f"Found figure titles in document: {figure_matches}")
            
            # 跟踪全局图片编号
            global_img_counter = 1
            
            # 遍历PDF的每一页
            for page_num in range(len(doc)):
                page = doc[page_num]
                # 获取当前页的所有图片
                image_list = page.get_images(full=True)
                
                logger.info(f"Page {page_num + 1} has {len(image_list)} embedded images")
                
                # 遍历当前页的每张图片
                for img_index, img in enumerate(image_list):
                    # img是一个元组，img[0]是图片的xref（引用编号）
                    xref = img[0]
                    # 获取图片的二进制数据
                    base_image = doc.extract_image(xref)
                    image_bytes = base_image["image"]
                    # 获取图片的扩展名（如png、jpg）
                    image_ext = base_image["ext"]
                    
                    # 尝试根据图片在页面上的位置找到最接近的图片标题
                    actual_number = str(global_img_counter)
                    
                    # 获取图片在页面上的bbox
                    pix = fitz.Pixmap(doc, xref)
                    if pix.n < 5:  # 如果不是灰度或彩色图片，跳过
                        # 尝试从页面文本中找到对应的图号
                        page_text = all_page_texts[page_num]
                        page_figures = re.findall(figure_pattern, page_text)
                        
                        if page_figures and global_img_counter <= len(page_figures):
                            actual_number = page_figures[min(global_img_counter - 1, len(page_figures) - 1)]
                        elif len(figure_matches) >= global_img_counter:
                            actual_number = figure_matches[global_img_counter - 1]
                        else:
                            # 如果没有找到对应的标题，使用顺序编号
                            actual_number = str(global_img_counter)
                    
                    # 使用图片在文档中的编号构造名称，格式为 {number}.png
                    image_filename = f"{actual_number}.png"
                    image_path = os.path.join(Config.IMAGES_FOLDER, image_filename)
                    
                    # 检查是否已经存在同名文件，如果是，使用下一个可用编号
                    counter = 0
                    original_image_path = image_path
                    original_actual_number = actual_number
                    while os.path.exists(image_path):
                        new_number = int(original_actual_number) + counter
                        image_filename = f"{new_number}.png"
                        image_path = os.path.join(Config.IMAGES_FOLDER, image_filename)
                        counter += 1
                    
                    # 保存图片，转换为PNG格式
                    img_pil = Image.open(io.BytesIO(image_bytes))
                    img_pil.save(image_path, "PNG")
                    
                    # 存储图片元数据
                    self._store_extracted_image_metadata(image_path, pdf_path, page_num + 1, actual_number)
                    extracted_images.append(image_path)
                    logger.info(f"Extracted: {image_filename} from page {page_num + 1}")
                    
                    global_img_counter += 1
            
            doc.close()
            logger.info(f"Extraction completed! Extracted {len(extracted_images)} images from {pdf_path}")
            
            # 检查是否所有找到的图号都被提取了
            if len(figure_matches) > len(extracted_images):
                logger.warning(f"Found {len(figure_matches)} figure titles but only extracted {len(extracted_images)} images. "
                              f"The figures referenced in text may be inline drawings or vector graphics that aren't "
                              f"extractable as separate image objects.")
        
        except Exception as e:
            logger.error(f"Error extracting images from {pdf_path}: {str(e)}")
        
        return extracted_images
    
    def _store_extracted_image_metadata(self, image_path: str, source_pdf: str, page_num: int, img_number: str):
        """
        存储提取图片的元数据
        """
        try:
            img = Image.open(image_path)
            img_id = str(uuid.uuid4())
            self.image_store[img_id] = {
                "path": image_path,
                "size": img.size,
                "mode": img.mode,
                "filename": os.path.basename(image_path),
                "source_pdf": source_pdf,
                "page_number": page_num,
                "img_number": img_number,  # 图片编号
                "type": "extracted"
            }
            logger.info(f"Stored metadata for extracted image: {image_path}")
        except Exception as e:
            logger.error(f"Error processing extracted image {image_path}: {str(e)}")
    
    def load_documents(self, documents_path: str):
        """
        Load documents from the specified path (including images)
        :param documents_path: Path to documents directory or file
        """
        documents = []
        
        # Check if path is a directory or file
        if os.path.isdir(documents_path):
            # Process different file types
            for ext in Config.SUPPORTED_IMAGE_FORMATS:
                image_files = Path(documents_path).glob(f"**/*{ext}")
                for img_path in image_files:
                    self._store_image_metadata(str(img_path))
            
            # Load text-based documents
            pdf_loader = DirectoryLoader(
                documents_path,
                glob="**/*.pdf",
                loader_cls=PyPDFLoader
            )
            txt_loader = DirectoryLoader(
                documents_path,
                glob="**/*.txt",
                loader_cls=TextLoader,
                loader_kwargs={'encoding': 'utf-8'}
            )
            
            pdf_docs = pdf_loader.load()
            txt_docs = txt_loader.load()
            
            documents = pdf_docs + txt_docs
        else:
            # Load single file based on extension
            file_ext = Path(documents_path).suffix.lower()
            
            if file_ext in Config.SUPPORTED_IMAGE_FORMATS:
                self._store_image_metadata(documents_path)
                # For images, we'll create a text representation for indexing
                from langchain.schema import Document
                image_desc = f"Image file: {os.path.basename(documents_path)}"
                doc = Document(
                    page_content=image_desc,
                    metadata={
                        "source": documents_path,
                        "type": "image",
                        "filename": os.path.basename(documents_path)
                    }
                )
                documents = [doc]
            elif documents_path.endswith('.pdf'):
                # 从PDF中提取图片
                extracted_images = self.extract_images_from_pdf(documents_path)
                logger.info(f"Extracted {len(extracted_images)} images from PDF: {documents_path}")
                
                loader = PyPDFLoader(documents_path)
                documents = loader.load()
            elif documents_path.endswith('.txt'):
                loader = TextLoader(documents_path, encoding='utf-8')
                documents = loader.load()
            else:
                raise ValueError(f"Unsupported file type: {documents_path}")
                
        logger.info(f"Loaded {len(documents)} documents and stored image metadata")
        return documents
    
    def _store_image_metadata(self, image_path: str):
        """
        Store image metadata for retrieval
        """
        try:
            img = Image.open(image_path)
            img_id = str(uuid.uuid4())
            self.image_store[img_id] = {
                "path": image_path,
                "size": img.size,
                "mode": img.mode,
                "filename": os.path.basename(image_path),
                "type": "original"
            }
            logger.info(f"Stored metadata for image: {image_path}")
        except Exception as e:
            logger.error(f"Error processing image {image_path}: {str(e)}")
    
    def chunk_documents(self, documents):
        """
        Split documents into chunks
        """
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=Config.CHUNK_SIZE,
            chunk_overlap=Config.CHUNK_OVERLAP
        )
        chunks = text_splitter.split_documents(documents)
        logger.info(f"Split documents into {len(chunks)} chunks")
        return chunks
    
    def index_documents(self, documents_path: str):
        """
        Load, chunk, and index documents (including images)
        :param documents_path: Path to documents to index
        """
        logger.info(f"Indexing documents from {documents_path}")
        
        # Load documents
        documents = self.load_documents(documents_path)
        
        # Chunk documents
        chunks = self.chunk_documents(documents)
        
        # Create vector store with FAISS
        if chunks:  # Only create vectorstore if there are text chunks
            self.vectorstore = FAISS.from_documents(
                documents=chunks,
                embedding=self.embeddings
            )
        
        # Persist FAISS index
        if self.vectorstore:
            self.vectorstore.save_local(Config.FAISS_INDEX_PATH)
        
        logger.info("Documents indexed successfully")
    
    def load_index(self):
        """
        Load an existing FAISS index
        """
        if os.path.exists(Config.FAISS_INDEX_PATH) and any(fname.endswith('.faiss') for fname in os.listdir(Config.FAISS_INDEX_PATH)):
            try:
                # 加载现有的FAISS索引
                self.vectorstore = FAISS.load_local(
                    Config.FAISS_INDEX_PATH,
                    self.embeddings,
                    allow_dangerous_deserialization=False  # 安全加载
                )
                logger.info("Existing FAISS index loaded")
            except Exception as e:
                logger.error(f"Error loading FAISS index: {str(e)}")
                logger.warning("No valid FAISS index found. Initialize with indexing first.")
        else:
            logger.warning("No existing FAISS index found. Initialize with indexing first.")
    
    def query(self, question: str, include_images: bool = True) -> Dict[str, Any]:
        """
        Query the indexed documents with optional image support
        :param question: Question to ask
        :param include_images: Whether to include images in the response
        :return: Response dictionary containing answer and sources
        """
        
        if not self.vectorstore and not self.image_store:
            return {"error": "No vector store or images initialized. Index documents first."}
        
        docs = []
        if self.vectorstore:
            # Retrieve relevant documents
            docs = self.vectorstore.similarity_search(question, k=Config.TOP_K_RESULTS)
        
        # Find any figure numbers mentioned in the question
        figure_pattern = r'(?:图|Fig\.?)\s*(\d+)'
        question_figure_numbers = re.findall(figure_pattern, question)
        
        # Enhance with image information if present
        relevant_images = []
        if include_images:
            # Find images that might be relevant based on question
            for img_id, img_meta in self.image_store.items():
                # Check if this image matches any figure number mentioned in the question
                if img_meta.get("type") == "extracted" and str(img_meta.get("img_number")) in question_figure_numbers:
                    relevant_images.append({
                        "id": img_id,
                        "path": img_meta["path"],
                        "filename": img_meta["filename"],
                        "type": img_meta.get("type", "original"),
                        "source_pdf": img_meta.get("source_pdf", ""),
                        "page_number": img_meta.get("page_number", ""),
                        "img_number": img_meta.get("img_number", "")
                    })
                # Also check general keywords for non-numbered images
                elif img_meta.get("type") != "extracted":  # Original images
                    image_name = img_meta['filename'].lower()
                    source_pdf = img_meta.get('source_pdf', '').lower()
                    
                    # Determine relevance based on keywords in the question
                    keywords_match = any(
                        keyword in question.lower() 
                        for keyword in ['image', 'picture', 'photo', 'visual', 
                                       image_name.split('.')[0], 
                                       source_pdf.split('/')[-1].split('\\')[-1].split('.')[0]]
                    )
                    
                    if keywords_match:
                        relevant_images.append({
                            "id": img_id,
                            "path": img_meta["path"],
                            "filename": img_meta["filename"],
                            "type": img_meta.get("type", "original"),
                            "source_pdf": img_meta.get("source_pdf", ""),
                            "page_number": img_meta.get("page_number", "")
                        })
        
        # Prepare context from retrieved documents
        context = "\n\n".join([doc.page_content for doc in docs]) if docs else ""
        
        # Include image information in context
        if relevant_images:
            image_info = "\n\nRelevant images:\n"
            for img in relevant_images:
                if img['type'] == 'extracted':
                    # Format image reference as <Desc>{img_number}.png</Desc>
                    image_info += f"<Desc>{img['img_number']}.png</Desc>\n"
                else:
                    image_info += f"- {img['filename']} (ID: {img['id']})\n"
            context += image_info
        
        # Generate response using Ollama
        response = ollama.chat(
            model=Config.OLLAMA_MODEL,
            messages=[
                {
                    'role': 'system',
                    'content': '''You are a helpful assistant that answers questions based on the provided context. Only use the provided context to answer the question. If the answer is not in the context, say "I don\'t know based on the provided documents." 

IMPORTANT: If the question relates to images or if images are mentioned in the context, you MUST use the EXACT format <Desc>{image_number}.png</Desc> to reference images in your response. DO NOT use phrases like "Figure X.png", "see Figure X", or similar variations. ONLY use the <Desc>X.png</Desc> format. Example: "<Desc>1.png</Desc>", "<Desc>2.png</Desc>", etc.'''
                },
                {
                    'role': 'user',
                    'content': f"Context: {context}\n\nQuestion: {question}\n\nPlease provide a detailed answer based on the context. If images are relevant, mention them using the EXACT format <Desc>{{image_number}}.png</Desc> and briefly describe them. DO NOT say things like 'Figure X.png' or 'See Figure X' - only use the <Desc>X.png</Desc> format."
                }
            ]
        )
        
        return {
            "answer": response['message']['content'],
            "sources": [doc.metadata for doc in docs] if docs else [],
            "images": relevant_images,
            "question_figure_numbers": question_figure_numbers
        }
    
    def get_image_path(self, img_id: str) -> str:
        """
        Get the file path for an image by ID
        """
        if img_id in self.image_store:
            return self.image_store[img_id]["path"]
        return None