import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

DB_FILE = "./data/agents.db"
engine = create_engine(f"sqlite:///{DB_FILE}")
SessionLocal = sessionmaker(bind=engine)

def test_fetch():
    db = SessionLocal()
    try:
        from database import FeedbackTable
        feedbacks = db.query(FeedbackTable).all()
        print(f"Total found: {len(feedbacks)}")
        
        results = []
        for f in feedbacks:
            user_prompt = "Unknown"
            session_id = "Unknown"
            
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
                "timestamp": str(f.timestamp),
                "comment_count": 0
            })
        print(results)
    except Exception as e:
        print(f"Error: {e}")
    finally:
        db.close()

test_fetch()
