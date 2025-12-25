import os

# Folder that contains your code files
SOURCE_FOLDER = "./"   # change this to your folder path
OUTPUT_FILE = "code.txt"

# File extensions you want to include
ALLOWED_EXTENSIONS = {".js", ".py", ".ts", ".jsx", ".tsx", ".html", ".css"}

with open(OUTPUT_FILE, "w", encoding="utf-8") as out:
    for root, dirs, files in os.walk(SOURCE_FOLDER):
        for file in files:
            ext = os.path.splitext(file)[1]
            if ext in ALLOWED_EXTENSIONS:
                file_path = os.path.join(root, file)

                out.write(f"\n\n===== {file_path} =====\n\n")

                try:
                    with open(file_path, "r", encoding="utf-8") as f:
                        out.write(f.read())
                except Exception as e:
                    out.write(f"[ERROR READING FILE: {e}]")

print(f"All code saved to {OUTPUT_FILE}")
