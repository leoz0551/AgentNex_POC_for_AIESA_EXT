import os
import logging
import uuid
import shutil
from fastapi import UploadFile
from sqlalchemy.orm import Session
from pathlib import Path

from config import DATA_DIR
from database import FeedbackTable, SessionLocal
from models import DetailedFeedback

logger = logging.getLogger(__name__)

# 附件存储目录
ATTACHMENTS_DIR = DATA_DIR / "feedback_attachments"
ATTACHMENTS_DIR.mkdir(exist_ok=True)

class FeedbackService:
    """详细反馈服务"""
    
    def save_detailed_feedback(
        self,
        message_id: str,
        category: str = None,
        what_went_wrong: str = None,
        additional_content: str = None,
        attachment: UploadFile = None,
        feedback_type: str = "dislike",
        user_id: str = "default",
        status: str = None,
        user_prompt: str = None
    ) -> DetailedFeedback:
        """保存详细反馈（支持点赞点踩）"""
        
        attachment_path = None
        
        # 处理附件
        if attachment:
            # 保持原始扩展名
            ext = os.path.splitext(attachment.filename)[1] if attachment.filename else ""
            # 使用 UUID 避免冲突
            filename = f"{message_id}_{uuid.uuid4().hex[:8]}{ext}"
            save_path = ATTACHMENTS_DIR / filename
            
            try:
                with open(save_path, "wb") as buffer:
                    shutil.copyfileobj(attachment.file, buffer)
                attachment_path = str(save_path)
                logger.info(f"Feedback attachment saved: {attachment_path}")
            except Exception as e:
                logger.error(f"Failed to save feedback attachment: {e}")
        
        # 默认状态
        if status is None:
            status = "Not Issue" if feedback_type == "like" else "Open"
            
        # 持久化到 SQLite
        db: Session = SessionLocal()
        try:
            db_feedback = FeedbackTable(
                message_id=message_id,
                user_id=user_id,
                type=feedback_type,
                category=category,
                what_went_wrong=what_went_wrong,
                additional_content=additional_content,
                attachment_path=attachment_path,
                status=status,
                user_prompt=user_prompt
            )
            db.add(db_feedback)
            db.commit()
            db.refresh(db_feedback)
            
            logger.info(f"Feedback ({feedback_type}) saved for message {message_id}")
            
            return DetailedFeedback(
                message_id=db_feedback.message_id,
                user_id=db_feedback.user_id,
                type=db_feedback.type,
                category=db_feedback.category,
                what_went_wrong=db_feedback.what_went_wrong,
                additional_content=db_feedback.additional_content,
                attachment_path=db_feedback.attachment_path,
                status=db_feedback.status,
                user_prompt=db_feedback.user_prompt,
                timestamp=db_feedback.timestamp
            )
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to save feedback entries: {e}")
            raise
        finally:
            db.close()

    def get_feedback_stats(self, user_id: str = "default"):
        """获取反馈统计信息"""
        db: Session = SessionLocal()
        from sqlalchemy import func
        try:
            total = db.query(FeedbackTable).count()
            likes = db.query(FeedbackTable).filter(FeedbackTable.type == "like").count()
            dislikes = db.query(FeedbackTable).filter(FeedbackTable.type == "dislike").count()
            
            return {
                "total": total,
                "likes": likes,
                "dislikes": dislikes,
                "comments": 0 # TODO: 评论统计
            }
        except Exception as e:
            logger.error(f"Error fetching stats: {e}")
            return {"total": 0, "likes": 0, "dislikes": 0, "comments": 0}
        finally:
            db.close()

    def get_feedback_list(self, user_id: str = "default", status_filter: str = "All", keyword: str = ""):
        """获取反馈列表"""
        from services.session_service import session_service
        db: Session = SessionLocal()
        try:
            query = db.query(FeedbackTable)
            
            if status_filter != "All":
                query = query.filter(FeedbackTable.status == status_filter)
            
            if keyword:
                query = query.filter(FeedbackTable.what_went_wrong.contains(keyword) | FeedbackTable.category.contains(keyword))
            
            feedbacks = query.order_by(FeedbackTable.timestamp.desc()).all()
            
            results = []
            for f in feedbacks:
                # 尝试通过 session_service 找到原始问题
                user_prompt = "Unknown"
                session_id = "Unknown"
                
                # 尽力去补充 session_id 和 prompt
                msg_result = session_service.find_message_by_id(f.message_id)
                if msg_result:
                    session, msg = msg_result
                    session_id = session.id
                    # 找到该消息前面的那条用户消息
                    for i, m in enumerate(session.messages):
                        if m.id == f.message_id and i > 0:
                            user_prompt = session.messages[i-1].content
                            break
                            
                # 如果数据库里有持久化的 prompt，优先使用数据库的
                if f.user_prompt:
                    user_prompt = f.user_prompt
                
                results.append({
                    "id": f.id,
                    "message_id": f.message_id,
                    "session_id": session_id,
                    "user_prompt": user_prompt,
                    "type": f.type,
                    "category": f.category,
                    "status": f.status,
                    "timestamp": f.timestamp,
                    "comment_count": 0
                })
            
            with open("debug_results.txt", "w") as dbg_f:
                dbg_f.write(str(len(results)))
                
            return results
        except Exception as e:
            import traceback
            with open("error_list.txt", "w") as err_f:
                err_f.write(traceback.format_exc())
            logger.error(f"Error fetching list: {e}")
            logger.error(traceback.format_exc())
            return []
        finally:
            db.close()

# 全局单例
feedback_service = FeedbackService()
