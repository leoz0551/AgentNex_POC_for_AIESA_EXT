# Multimodal AGNO RAG System with Ollama, FAISS and Streamlit

This project demonstrates a Multimodal Retrieval-Augmented Generation (RAG) system built with AGNO framework, Ollama (using qwen2.5:7b model), FAISS vector database, and Streamlit UI. The system supports both text and image content indexing and retrieval.

## Features

- Document indexing and retrieval using FAISS vector embeddings
- Image indexing and display capabilities
- Interactive web interface powered by Streamlit
- Local LLM deployment using Ollama
- Support for PDF, TXT documents and multiple image formats (JPG, PNG, BMP, TIFF)
- Source attribution for generated answers
- Visual display of relevant images in the UI

## Prerequisites

- Python 3.8+
- Ollama installed and running
- qwen2.5:7b model pulled in Ollama (`ollama pull qwen2.5:7b`)

## Setup

1. Clone this repository
2. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Copy `.env.example` to `.env` and adjust settings if needed:
   ```bash
   cp .env.example .env
   ```
4. Pull the required model in Ollama:
   ```bash
   ollama pull qwen2.5:7b
   ```

## Running the Application

1. Start Ollama service (if not already running):
   ```bash
   ollama serve
   ```
2. Run the Streamlit app:
   ```bash
   streamlit run app_multimodal.py
   ```
3. Open your browser and go to the URL shown in the terminal (typically http://localhost:8501)

## Usage

1. **Index Content**: 
   - Upload documents and images using the sidebar uploader, or
   - Enter a path to a directory containing documents and images

2. **Ask Questions**:
   - Enter your question about the content in the main panel
   - Click "Generate Answer"
   - Review the response, sources, and any relevant images

## Architecture

- `multimodal_rag_engine.py`: Core multimodal RAG functionality including document/image loading, indexing, and querying
- `config.py`: Configuration settings for the application including supported image formats
- `app_multimodal.py`: Streamlit UI implementation with image display capabilities
- `requirements.txt`: Python dependencies
- `.env.example`: Example environment configuration

## Customization

- Modify `config.py` to adjust chunk size, number of results, etc.
- Change the model by updating the `OLLAMA_MODEL` in `.env`
- Adjust FAISS index settings in `config.py`
- Add more supported image formats in `config.py`

## Troubleshooting

- Ensure Ollama is running before starting the application
- If you encounter memory issues, reduce the chunk size in config
- For document loading errors, verify file format and permissions
- Make sure FAISS is properly installed (faiss-cpu for CPU or faiss-gpu for GPU)
- For image display issues, ensure Pillow is correctly installed