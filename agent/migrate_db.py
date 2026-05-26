import sqlite3
import os

db_path = './data/agents.db'

if os.path.exists(db_path):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Check current columns
    cursor.execute("PRAGMA table_info(detailed_feedback)")
    columns = [col[1] for col in cursor.fetchall()]
    print(f"Current columns: {columns}")
    
    if 'user_id' not in columns:
        cursor.execute("ALTER TABLE detailed_feedback ADD COLUMN user_id TEXT DEFAULT 'default'")
        print("Added user_id column")
        
    if 'type' not in columns:
        cursor.execute("ALTER TABLE detailed_feedback ADD COLUMN type TEXT DEFAULT 'dislike'")
        print("Added type column")
        
    if 'status' not in columns:
        cursor.execute("ALTER TABLE detailed_feedback ADD COLUMN status TEXT DEFAULT 'Open'")
        print("Added status column")

    if 'user_prompt' not in columns:
        cursor.execute("ALTER TABLE detailed_feedback ADD COLUMN user_prompt TEXT")
        print("Added user_prompt column")
        
    conn.commit()
    conn.close()
    print("Migration complete.")
else:
    print(f"Database not found at {db_path}")
