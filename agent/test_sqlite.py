import sqlite3
import pprint

conn = sqlite3.connect('./data/agents.db')
conn.row_factory = sqlite3.Row
cursor = conn.cursor()
cursor.execute("SELECT * FROM detailed_feedback;")
rows = cursor.fetchall()
for row in rows:
    pprint.pprint(dict(row))
conn.close()
