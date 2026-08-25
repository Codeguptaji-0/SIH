import os
import sqlite3

def initialize_database():
    db_path = "skillsetu.db"
    
    # Path to schema and seed files
    base_dir = os.path.dirname(os.path.abspath(__file__))
    schema_path = os.path.join(base_dir, "..", "database", "schema.sql")
    seed_path = os.path.join(base_dir, "..", "database", "seed.sql")

    print(f"Initializing SkillSetu database at {db_path}...")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    if os.path.exists(schema_path):
        with open(schema_path, "r", encoding="utf-8") as f:
            schema_sql = f.read()
            cursor.executescript(schema_sql)
        print("[OK] Executed schema.sql successfully.")

    if os.path.exists(seed_path):
        with open(seed_path, "r", encoding="utf-8") as f:
            seed_sql = f.read()
            cursor.executescript(seed_sql)
        print("[OK] Executed seed.sql successfully.")

    conn.commit()
    conn.close()
    print("Database initialization complete!")

if __name__ == "__main__":
    initialize_database()
