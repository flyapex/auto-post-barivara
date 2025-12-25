import os

root_dir = os.getcwd()
skip_dirs = {"node_modules", "dist", ".git"}

with open("files.txt", "w", encoding="utf-8") as f:
    for root, dirs, files in os.walk(root_dir):
        dirs[:] = [d for d in dirs if d not in skip_dirs]

        for file in files:
            if file.startswith(".git"):
                continue

            full_path = os.path.join(root, file)
            relative_path = os.path.relpath(full_path, root_dir)
            f.write(relative_path + "\n")

print("Relative file list saved to files.txt (git ignored)")
