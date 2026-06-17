import os
import ollama
from langchain_community.vectorstores import FAISS
# from langchain_community.vectorstores import Chroma  # Replaced with FAISS
from langchain_community.document_loaders import PyPDFLoader, TextLoader, DirectoryLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.embeddings import OllamaEmbeddings
from config import Config
from typing import List, Dict, Any
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class RAGEngine:
    def __init__(self):
        self.vectorstore = None
        self.embeddings = OllamaEmbeddings(
            model=Config.OLLAMA_MODEL,
            base_url=f"http://{Config.OLLAMA_HOST}"
        )
        
    def load_documents(self, documents_path: str):
        """
        Load documents from the specified path
        :param documents_path: Path to documents directory or file
        """
        # Check if path is a directory or file
        if os.path.isdir(documents_path):
            # Load all supported files in directory
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
            if documents_path.endswith('.pdf'):
                loader = PyPDFLoader(documents_path)
                documents = loader.load()
            elif documents_path.endswith('.txt'):
                loader = TextLoader(documents_path, encoding='utf-8')
                documents = loader.load()
            else:
                raise ValueError(f"Unsupported file type: {documents_path}")
                
        logger.info(f"Loaded {len(documents)} documents")
        return documents
    
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
        Load, chunk, and index documents
        :param documents_path: Path to documents to index
        """
        logger.info(f"Indexing documents from {documents_path}")
        
        # Load documents
        documents = self.load_documents(documents_path)
        
        # Chunk documents
        chunks = self.chunk_documents(documents)
        
        # Create vector store with FAISS
        self.vectorstore = FAISS.from_documents(
            documents=chunks,
            embedding=self.embeddings
        )
        
        # Persist FAISS index
        self.vectorstore.save_local(Config.FAISS_INDEX_PATH)
        
        logger.info("Documents indexed successfully")
    
    def load_index(self):
        """
        Load an existing FAISS index
        """
        if os.path.exists(Config.FAISS_INDEX_PATH):
            # Completely removed the deprecated parameter
            self.vectorstore = FAISS.load_local(
                Config.FAISS_INDEX_PATH,
                self.embeddings
            )
            logger.info("Existing FAISS index loaded")
        else:
            logger.warning("No existing FAISS index found. Initialize with indexing first.")
    
    def query(self, question: str) -> Dict[str, Any]:
        """
        Query the indexed documents
        :param question: Question to ask
        :return: Response dictionary containing answer and sources
        """
        if not self.vectorstore:
            return {"error": "No vector store initialized. Index documents first."}
        
        # Retrieve relevant documents
        docs = self.vectorstore.similarity_search(question, k=Config.TOP_K_RESULTS)
        
        # Prepare context from retrieved documents
        context = "\n\n".join([doc.page_content for doc in docs])
        
        # Generate response using Ollama
        response = ollama.chat(
            model=Config.OLLAMA_MODEL,
            messages=[
                {
                    'role': 'system',
                    'content': 'You are a helpful assistant that answers questions based on the provided context. Only use the provided context to answer the question. If the answer is not in the context, say "I don\'t know based on the provided documents."'
                },
                {
                    'role': 'user',
                    'content': f"Context: {context}\n\nQuestion: {question}\n\nPlease provide a detailed answer based on the context."
                }
            ]
        )
        
        return {
            "answer": response['message']['content'],
            "sources": [doc.metadata for doc in docs]
        }