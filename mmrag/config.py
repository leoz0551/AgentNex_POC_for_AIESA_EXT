import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class Config:
    # Ollama Configuration
    OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5:7b")
    OLLAMA_HOST = os.getenv("OLLAMA_HOST", "localhost:11434")
    
    # Vector store configuration
    # VECTOR_STORE_PATH = "./vector_store"  # Old Chroma path
    FAISS_INDEX_PATH = "./faiss_index"
    
    # Application settings
    CHUNK_SIZE = 1000
    CHUNK_OVERLAP = 100
    TOP_K_RESULTS = 5
    
    # Multimodal settings
    SUPPORTED_IMAGE_FORMATS = ['.jpg', '.jpeg', '.png', '.bmp', '.tiff']
    UPLOAD_FOLDER = './uploads'
    IMAGES_FOLDER = './imgs'  # 新增：图片存储路径
    MAX_CONTENT_SIZE = 10 * 1024 * 1024  # 10MB max file size