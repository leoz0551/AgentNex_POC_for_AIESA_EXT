from fastapi import APIRouter, File, UploadFile, Depends, HTTPException
from sqlalchemy.orm import Session
import pandas as pd
import io
import uuid
import json
import logging

from models_chatbi import UserInfo, UserQuery, QueryContent, get_db, init_db

logger = logging.getLogger(__name__)

router = APIRouter()

# Initialize DB
init_db()

@router.post("/upload")
async def upload_data(file: UploadFile = File(...), clear: bool = False, db: Session = Depends(get_db)):
    if not file.filename.endswith('.xlsx') and not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only .xlsx or .csv files are supported")
    
    try:
        if clear:
            logger.info("Clearing existing ChatBI data before upload...")
            db.query(QueryContent).delete()
            db.query(UserQuery).delete()
            db.query(UserInfo).delete()
            db.commit()
        contents = await file.read()
        if file.filename.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(contents))
        else:
            df = pd.read_excel(io.BytesIO(contents))
            
        # Standardize column names based on the required schema
        df.columns = df.columns.str.strip().str.lower().str.replace(' ', '_')
        
        # Mapping common variations to our expected schema
        rename_map = {
            'query': 'user_query',
            'question': 'user_query',
            'user_message': 'user_query',
            'prompt': 'user_query',
            'answer': 'ai_response',
            'response': 'ai_response',
            'bot_response': 'ai_response'
        }
        df = df.rename(columns=rename_map)
        
        # Replace NaN/NaT with empty strings to prevent "nan" strings in database
        df = df.fillna("")
        
        processed_users = set()
        user_info_objects = []
        user_query_objects = []
        query_content_objects = []
        
        for _, row in df.iterrows():
            username = str(row.get('username'))
            
            # UserInfo
            if username not in processed_users:
                exists = db.query(UserInfo).filter(UserInfo.username == username).first()
                if not exists:
                    user_info_objects.append(UserInfo(
                        username=username,
                        group_name=str(row.get('l1_org_name', '')),
                        org_name=str(row.get('l2_org_name', '')),
                        dept_name=str(row.get('l3_org_name', '')),
                        team_name=str(row.get('l4_org_name', ''))
                    ))
                processed_users.add(username)
            
            # UserQuery and QueryContent
            qid = str(uuid.uuid4())
            rid = str(uuid.uuid4())
            
            user_query_objects.append(UserQuery(
                query_id=qid,
                session_id=str(row.get('session_id', '')),
                username=username,
                response_id=rid,
                q_time=pd.to_datetime(row.get('q_time', 'now')) if 'q_time' in row else pd.Timestamp.now()
            ))
            
            query_content_objects.append(QueryContent(
                query_id=qid,
                response_id=rid,
                user_query=str(row.get('user_query', '')),
                ai_response=str(row.get('ai_response', ''))
            ))
            
        if user_info_objects:
            db.add_all(user_info_objects)
            db.commit()
            
        if user_query_objects:
            db.add_all(user_query_objects)
        if query_content_objects:
            db.add_all(query_content_objects)
            
        db.commit()
        
        return {"status": "success", "message": f"Processed {len(user_query_objects)} records successfully."}
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
