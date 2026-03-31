"""
文档元数据服务模块
负责知识库文档的元数据管理
"""

import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List

from config import DOCUMENTS_META_FILE

logger = logging.getLogger(__name__)


class DocumentService:
    """文档元数据管理服务"""
    
    def __init__(self, meta_file: Path = DOCUMENTS_META_FILE):
        self.meta_file = meta_file
    
    def load_meta(self) -> Dict[str, Any]:
        """加载文档元数据"""
        if self.meta_file.exists():
            with open(self.meta_file, "r", encoding="utf-8") as f:
                return json.load(f)
        return {"documents": []}
    
    def save_meta(self, meta: Dict[str, Any]):
        """保存文档元数据"""
        with open(self.meta_file, "w", encoding="utf-8") as f:
            json.dump(meta, f, ensure_ascii=False, indent=2)
    
    def add(
        self,
        doc_id: str,
        filename: str,
        file_path: str,
        doc_type: str,
        user_id: str,
        chunk_count: int = 0,
        title: str = "",
        summary: str = "",
        **kwargs
    ) -> Dict[str, Any]:
        """添加文档元数据"""
        meta = self.load_meta()
        doc = {
            "id": doc_id,
            "filename": filename,
            "file_path": file_path,
            "type": doc_type,
            "user_id": user_id,
            "chunk_count": chunk_count,
            "created_at": datetime.now().isoformat(),
        }
        # 添加可选字段
        if title:
            doc["title"] = title
        if summary:
            doc["summary"] = summary
        # 支持额外字段
        doc.update(kwargs)
        meta["documents"].append(doc)
        self.save_meta(meta)
        return doc
    
    def get(self, doc_id: str = None, user_id: str = None) -> List[Dict]:
        """获取文档元数据"""
        meta = self.load_meta()
        docs = meta.get("documents", [])
        if doc_id:
            docs = [d for d in docs if d.get("id") == doc_id]
        if user_id:
            docs = [d for d in docs if d.get("user_id") == user_id]
        return docs
    
    def remove(self, doc_id: str):
        """删除文档元数据"""
        meta = self.load_meta()
        meta["documents"] = [d for d in meta.get("documents", []) if d.get("id") != doc_id]
        self.save_meta(meta)
    
    def clear(self):
        """清空所有文档元数据"""
        self.save_meta({"documents": []})
    
    def get_file_size(self, file_path: str) -> int:
        """获取文件大小"""
        if not file_path or file_path.startswith(("text://", "http")):
            return 0
        
        p = Path(file_path)
        if p.exists():
            return p.stat().st_size
        return 0
    
    def get_file_modified_time(self, file_path: str) -> str:
        """获取文件修改时间"""
        if not file_path or file_path.startswith(("text://", "http")):
            return ""
        
        p = Path(file_path)
        if p.exists():
            return datetime.fromtimestamp(p.stat().st_mtime).isoformat()
        return ""
    
    def enrich_with_file_info(self, doc: Dict) -> Dict:
        """为文档添加文件大小和修改时间信息"""
        file_path = doc.get("file_path", "")
        if not file_path.startswith(("text://", "http")):
            p = Path(file_path)
            if p.exists():
                doc["size"] = p.stat().st_size
                doc["modified"] = datetime.fromtimestamp(p.stat().st_mtime).isoformat()
        return doc
    
    def get_stats(self) -> Dict[str, Any]:
        """获取文档统计信息"""
        docs = self.get()
        
        total_size = 0
        types = {}
        
        for d in docs:
            # 统计类型
            t = d.get("type", "unknown")
            types[t] = types.get(t, 0) + 1
            
            # 统计大小
            file_path = d.get("file_path", "")
            if not file_path.startswith(("text://", "http")):
                p = Path(file_path)
                if p.exists():
                    total_size += p.stat().st_size
        
        return {
            "total_documents": len(docs),
            "total_size_bytes": total_size,
            "total_size_mb": round(total_size / 1024 / 1024, 2),
            "types": types,
        }


# 全局单例
document_service = DocumentService()
