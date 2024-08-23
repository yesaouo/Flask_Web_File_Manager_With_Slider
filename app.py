from flask import Flask, request, jsonify
from flask_cors import CORS
import os, shutil
from datetime import datetime

os.makedirs('uploads', exist_ok=True)
os.makedirs('content', exist_ok=True)
app = Flask(__name__)
CORS(app)  # 啟用CORS以允許前端跨域請求

@app.route('/api/folders', methods=['GET'])
def get_pdfs():
    return jsonify(get_upload_folders())

@app.route('/api/progress', methods=['GET'])
def get_progress():
    # 取得 uploads 和 content 的結構
    uploads_structure = get_directory_structure('./uploads')
    content_structure = get_directory_structure('./content')

    # 計算 uploads 中的檔案數量
    uploads_files = []
    for folder in uploads_structure:
        uploads_files.extend(folder['fileNames'])
    uploads_file_count = len(uploads_files)

    # 計算 content 中與 uploads 相同的檔案數量
    content_files = []
    for folder in content_structure:
        content_files.extend(folder['fileNames'])

    # 找出 uploads 中的檔案與 content 中相同的檔案
    common_files = set(uploads_files) & set(content_files)
    common_file_count = len(common_files)

    return jsonify({"value": common_file_count, "max": uploads_file_count, "isProcessing": False})

@app.route('/api/upload/<string:folder_name>', methods=['GET'])
def upload_folder(folder_name):
    os.makedirs(f'uploads/{folder_name}', exist_ok=True)
    return jsonify({"success": True, "foldername": folder_name})

@app.route('/api/upload/<string:folder_name>', methods=['POST'])
def upload_file(folder_name):
    os.makedirs(folder_name, exist_ok=True)
    if 'file' not in request.files:
        return jsonify({"success": False, "error": "No file part"}), 400
    file = request.files['file']
    file_name = file.filename
    if file_name == '':
        return jsonify({"success": False, "error": "No selected file"}), 400
    file.save(os.path.join(f'uploads/{folder_name}', file_name))
    return jsonify({"success": True, "filename": file_name})

@app.route('/api/move', methods=['POST'])
def move_file():
    data = request.json
    file_name = data.get('file_name')
    source_folder = 'uploads/' + data.get('source_folder')
    target_folder = 'uploads/' + data.get('target_folder')
    source_path = source_folder + '/' + file_name
    target_path = target_folder + '/' + file_name

    if not file_name or not source_folder or not target_folder:
        return jsonify({"error": "file_name and source_folder and target_folder are required"}), 400

    if not os.path.exists(source_path):
        return jsonify({"error": "Source file does not exist"}), 404

    if not os.path.exists(target_folder):
        try:
            os.makedirs(target_folder)
        except OSError as e:
            return jsonify({"error": f"Failed to create target folder: {str(e)}"}), 500

    try:
        shutil.move(source_path, target_path)
    except Exception as e:
        return jsonify({"error": f"Failed to move file: {str(e)}"}), 500

    return jsonify({"success": True, "filename": file_name}), 200

@app.route('/api/terminate', methods=['POST'])
def terminate_app():
    current_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    client_ip = request.remote_addr
    print(f"Termination requested at {current_time} from IP: {client_ip}")
    os._exit(0)

def get_upload_folders():
    return get_directory_structure('./uploads')

def get_directory_structure(directory):
    result = []
    for root, dirs, files in os.walk(directory):
        for dir_name in dirs:
            dir_path = os.path.join(root, dir_name)
            # 列出資料夾中的檔案
            file_names = os.listdir(dir_path)
            # 只保留檔案名稱，不包括子資料夾
            file_names = [file for file in file_names if os.path.isfile(os.path.join(dir_path, file))]
            # 將結果加入到列表中
            result.append({'name': dir_name, 'fileNames': file_names})
    return result

if __name__ == '__main__':
    app.run(debug=True)