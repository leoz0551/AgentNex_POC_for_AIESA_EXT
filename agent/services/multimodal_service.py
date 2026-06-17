"""
Multimodal Service Module
Handles image extraction from various document formats and metadata storage/retrieval.
"""

import os
import io
import re
import json
import uuid
import logging
from pathlib import Path
from typing import Dict, Any, List, Optional

from config import IMAGES_DIR, IMAGE_META_FILE

try:
    import fitz  # PyMuPDF
except ImportError:
    fitz = None

try:
    from PIL import Image
except ImportError:
    Image = None

logger = logging.getLogger(__name__)


class BaseExtractor:
    """Base class for document extractors"""
    def extract(self, file_path: str, doc_id: str, user_id: str) -> List[Dict[str, Any]]:
        raise NotImplementedError("Subclasses must implement extract()")


class PDFExtractor(BaseExtractor):
    """Extractor for PDF documents"""
    def extract(self, file_path: str, doc_id: str, user_id: str) -> List[Dict[str, Any]]:
        if not fitz or not Image:
            logger.error("PyMuPDF or Pillow is not installed. Cannot extract images.")
            return []

        extracted_images = []
        try:
            doc = fitz.open(file_path)
            all_text = ""
            all_page_texts = []
            
            for page_num in range(len(doc)):
                page = doc[page_num]
                page_text = page.get_text()
                all_text += page_text
                all_page_texts.append(page_text)
                
            figure_pattern = r'(?:图|Fig\.?)\s*(\d+)'
            figure_matches = re.findall(figure_pattern, all_text)
            logger.info(f"[PDFExtractor] Found figure titles: {figure_matches}")
            
            global_img_counter = 1
            
            # Create doc-specific directory
            doc_img_dir = IMAGES_DIR / doc_id
            doc_img_dir.mkdir(parents=True, exist_ok=True)
            
            for page_num in range(len(doc)):
                page = doc[page_num]
                image_list = page.get_images(full=True)
                
                for img_index, img in enumerate(image_list):
                    xref = img[0]
                    base_image = doc.extract_image(xref)
                    image_bytes = base_image["image"]
                    
                    actual_number = str(global_img_counter)
                    pix = fitz.Pixmap(doc, xref)
                    if pix.n < 5:  
                        page_text = all_page_texts[page_num]
                        page_figures = re.findall(figure_pattern, page_text)
                        
                        if page_figures and global_img_counter <= len(page_figures):
                            actual_number = page_figures[min(global_img_counter - 1, len(page_figures) - 1)]
                        elif len(figure_matches) >= global_img_counter:
                            actual_number = figure_matches[global_img_counter - 1]
                        else:
                            actual_number = str(global_img_counter)
                    
                    image_filename = f"{actual_number}.png"
                    image_path = doc_img_dir / image_filename
                    
                    counter = 0
                    original_actual_number = actual_number
                    while image_path.exists():
                        new_number = int(original_actual_number) + counter
                        image_filename = f"{new_number}.png"
                        image_path = doc_img_dir / image_filename
                        counter += 1
                        actual_number = str(new_number)
                    
                    img_pil = Image.open(io.BytesIO(image_bytes))
                    # Check mode to avoid error when saving PNG
                    if img_pil.mode in ("RGBA", "P"):
                        img_pil = img_pil.convert("RGB")
                    img_pil.save(str(image_path), "PNG")
                    
                    extracted_images.append({
                        "path": str(image_path),
                        "filename": image_filename,
                        "doc_id": doc_id,
                        "user_id": user_id,
                        "page_number": page_num + 1,
                        "img_number": actual_number,
                        "type": "extracted",
                        "size": img_pil.size,
                        "mode": img_pil.mode
                    })
                    
                    global_img_counter += 1
            
            doc.close()
            logger.info(f"[PDFExtractor] Completed! Extracted {len(extracted_images)} images from {file_path}")
            
        except Exception as e:
            logger.error(f"[PDFExtractor] Error extracting from {file_path}: {e}")
            
        return extracted_images


class MultimodalService:
    """Service to handle multimodal extraction and retrieval"""
    
    def __init__(self):
        self.meta_file = IMAGE_META_FILE
        self.extractors = {
            '.pdf': PDFExtractor()
            # Future extensions:
            # '.pptx': PPTExtractor()
            # '.docx': WordExtractor()
        }
        
    def load_meta(self) -> Dict[str, Any]:
        if self.meta_file.exists():
            try:
                with open(self.meta_file, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception as e:
                logger.error(f"Error loading image meta: {e}")
        return {}

    def save_meta(self, meta: Dict[str, Any]):
        try:
            with open(self.meta_file, "w", encoding="utf-8") as f:
                json.dump(meta, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.error(f"Error saving image meta: {e}")

    def process_document(self, file_path: str, doc_id: str, user_id: str, doc_type: str):
        """Extract images and store metadata"""
        extractor = self.extractors.get(doc_type.lower())
        if not extractor:
            logger.info(f"No multimodal extractor configured for doc_type: {doc_type}")
            return
            
        logger.info(f"Processing multimodal extraction for {file_path}")
        extracted_data = extractor.extract(file_path, doc_id, user_id)
        
        if extracted_data:
            meta = self.load_meta()
            for img_data in extracted_data:
                img_id = str(uuid.uuid4())
                meta[img_id] = img_data
            self.save_meta(meta)
            logger.info(f"Stored {len(extracted_data)} image metadata records.")

    def find_relevant_images(self, question: str, user_id: str) -> List[Dict[str, Any]]:
        """Find relevant images for a user's question"""
        meta = self.load_meta()
        if not meta:
            return []
            
        figure_pattern = r'(?:图|Fig\.?)\s*(\d+)'
        question_figure_numbers = re.findall(figure_pattern, question)
        
        relevant_images = []
        
        for img_id, img_meta in meta.items():
            # Check user access
            if img_meta.get("user_id") != user_id:
                continue
                
            if img_meta.get("type") == "extracted" and str(img_meta.get("img_number")) in question_figure_numbers:
                relevant_images.append({
                    "id": img_id,
                    "doc_id": img_meta.get("doc_id", ""),
                    "filename": img_meta.get("filename", ""),
                    "img_number": img_meta.get("img_number", "")
                })
                
        return relevant_images

    def find_contextual_images(self, doc_id: str, text_content: str, page_number: Optional[int] = None) -> List[Dict[str, Any]]:
        """Find images for a specific RAG context chunk using dual-strategy (Regex + Page)"""
        meta = self.load_meta()
        if not meta or not doc_id:
            return []
            
        # Strategy 1: Find explicit mentions of figures in the text (e.g., "图1")
        figure_pattern = r'(?:图|Fig\.?)\s*(\d+)'
        text_figure_numbers = re.findall(figure_pattern, text_content)
        
        relevant_images = []
        seen_ids = set()
        
        for img_id, img_meta in meta.items():
            # Must match doc_id
            # Remove uuid prefixes from doc_id comparison if necessary, but image_store should have the same doc_id
            if img_meta.get("doc_id") != doc_id:
                continue
                
            is_match = False
            
            # Match by explicit text reference
            if img_meta.get("type") == "extracted" and str(img_meta.get("img_number")) in text_figure_numbers:
                is_match = True
                
            # Match by page number
            elif page_number is not None and img_meta.get("page_number") == page_number:
                is_match = True
                
            if is_match and img_id not in seen_ids:
                relevant_images.append({
                    "doc_id": img_meta.get("doc_id", ""),
                    "filename": img_meta.get("filename", ""),
                    "img_number": img_meta.get("img_number", ""),
                    "page_number": img_meta.get("page_number", "")
                })
                seen_ids.add(img_id)
                
        return relevant_images


# Global singleton
multimodal_service = MultimodalService()
