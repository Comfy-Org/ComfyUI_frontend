import os
import sys
import requests
import zipfile
import shutil
import git
import tempfile


def download_and_extract(version, temp_dir):
    url = f"https://github.com/Comfy-Org/ComfyUI_frontend/releases/download/v{version}/dist.zip"
    response = requests.get(url)

    if response.status_code == 200:
        zip_path = os.path.join(temp_dir, "dist.zip")
        with open(zip_path, "wb") as file:
            file.write(response.content)

        with zipfile.ZipFile(zip_path, "r") as zip_ref:
            zip_ref.extractall(temp_dir)

        # Clean up the zip file after extraction
        os.remove(zip_path)
    else:
        raise Exception(
            f"Failed to download release asset. Status code: {response.status_code}"
        )


def update_repo(repo_path, version, temp_dir):
    repo = git.Repo(repo_path)

    # Stash any changes
    repo.git.stash()

    # Create and checkout new branch
    new_branch = f"release-{version}"
    repo.git.checkout("-b", new_branch, "-t", "origin/master")

    # Remove all files under web/ directory
    web_dir = os.path.join(repo_path, "web")
    if os.path.exists(web_dir):
        shutil.rmtree(web_dir)

    # Move content from temp_dir to web/
    shutil.move(temp_dir, web_dir)

    # Add changes and commit
    repo.git.add(all=True)
    commit_message = f"Update web content to release v{version}"
    repo.git.commit("-m", commit_message)


def main(repo_path: str, version: str):
    with tempfile.TemporaryDirectory() as temp_dir:
        try:
            download_and_extract(version, temp_dir)
            update_repo(repo_path, version, temp_dir)
            print(f"Successfully updated repo to release v{version}")
        except Exception as e:
            print(f"An error occurred: {str(e)}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python script.py <repo_path> <version>")
        sys.exit(1)

    repo_path = sys.argv[1]
    version = sys.argv[2]
    main(repo_path, version)
