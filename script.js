const API_BASE_URL = 'http://localhost:5000/api';

let folderList = [];
let progressObject = {value: 0, max: 0, isProcessing: false};

document.addEventListener('DOMContentLoaded', function() {
    const nav = document.querySelector('nav');
    const main = document.querySelector('main');
    const menuIcon = document.querySelector('.menu-icon');
    const setsIcon = document.querySelector('.sets-icon');
    const folderContainer = document.getElementById('folderContainer');
    const createFolderBtn = document.getElementById('createFolderBtn');
    const deleteBtn = document.getElementById('deleteBtn');
    const fileInput = document.getElementById('fileInput');
    const settingsDialog = document.getElementById('settingsDialog');
    const settingsContent = document.getElementById('settingsContent');
    const closeBackendBtn = document.getElementById('closeBackendBtn');
    const settingsCloseBtn = document.getElementById('settingsCloseBtn');
    const snackbar = document.getElementById("snackbar");
    let deleteMode = false;
    
    fileInput.addEventListener('change', handleFileUpload);
    createFolderBtn.addEventListener('click', handleFolderUpload);
    deleteBtn.addEventListener('click', toggleDeleteMode);
    closeBackendBtn.addEventListener('click', closeBackend);
    
    menuIcon.addEventListener('click', function() {
        nav.style.display = nav.style.display === 'none' ? 'flex' : 'none';
        main.style.width = main.style.width === '100%' ? 'calc(100% - 200px)' : '100%';
    });
    setsIcon.addEventListener('click', function() {
        settingsDialog.showModal();
    });

    settingsCloseBtn.addEventListener('click', () => {
        settingsDialog.close();
    });
    settingsDialog.addEventListener('click', (event) => {
        if (!settingsContent.contains(event.target)) {
            settingsDialog.close();
        }
    });

    folderContainer.addEventListener('dragstart', (e) => {
        if (e.target.draggable) {
            const folderName = e.target.closest('.folder').querySelector('.folder-header span').textContent;
            const fileName = e.target.innerHTML;
            e.dataTransfer.setData('text/plain', e.target.outerHTML);
            e.dataTransfer.setData('folderName', folderName);
            e.dataTransfer.setData('fileName', fileName);
            e.dataTransfer.effectAllowed = 'move';
            setTimeout(() => {
                e.target.style.display = 'none';
            }, 0);
        }
    });
    folderContainer.addEventListener('dragend', (e) => {
        if (e.target.draggable) {
            e.target.style.display = '';
            if (!e.dataTransfer.dropEffect || e.dataTransfer.dropEffect === 'none') {
                e.target.style.display = '';
            }
        }
    });
    folderContainer.addEventListener('click', (e) => {
        if (deleteMode) {
            const target = e.target.closest('.folder, .file-link');
            if (target) {
                target.remove();
            }
        }
    });

    fetchFolders();
    fetchProgressObject();
  
    function dragOver(e) {
        e.preventDefault();
        e.currentTarget.classList.add('dragover');
    }
  
    function dragLeave(e) {
        e.preventDefault();
        e.currentTarget.classList.remove('dragover');
    }
  
    function drop(e) {
        e.preventDefault();
        e.currentTarget.classList.remove('dragover');
        const targetFolderContent = e.currentTarget.querySelector('.folder-content');
        const targetFolder = targetFolderContent.parentNode.querySelector('.folder-header span').textContent;
        const dt = e.dataTransfer;
          
        // 文件拖放的情況
        const files = dt.files;
        if (files.length > 0) {
            handleFileAddition(targetFolderContent, files);
            return;
        }
          
        // HTML 元素拖放的情況
        const data = dt.getData('text');
        const folderName = dt.getData('folderName')
        const fileName = dt.getData('fileName');
        const draggedElement = document.createElement('div');
        draggedElement.innerHTML = data;
        const newElement = draggedElement.firstChild;
    
        if (targetFolder === folderName) {
            const originalElement = document.querySelector(`[draggable="true"][style="display: none;"]`);
            if (originalElement) {
                originalElement.style.display = '';  // 取消隱藏，使其重新顯示
            }
            return;
        }

        if (getTargetFile(targetFolderContent, fileName)) {
            if (confirm(`資料夾 "${targetFolder}" 已有一個名為 "${fileName}" 的檔案，是否確定要覆蓋？`)) {
                if (dt.effectAllowed === 'move') {
                    const originalElement = document.querySelector(`[draggable="true"][style="display: none;"]`);
                    if (originalElement) {
                        originalElement.remove();
                    }
                }
            } else {
                const originalElement = document.querySelector(`[draggable="true"][style="display: none;"]`);
                if (originalElement) {
                    originalElement.style.display = '';  // 取消隱藏，使其重新顯示
                }
                return;
            }
        } else {
            if (dt.effectAllowed === 'move') {
                const originalElement = document.querySelector(`[draggable="true"][style="display: none;"]`);
                if (originalElement) {
                    originalElement.remove();
                }
            }
        
            targetFolderContent.appendChild(newElement);
        }
        
        moveFile(fileName, folderName, targetFolder);
    }

    function handleFileUpload(e) {
        const files = e.target.files;
        const targetFolderName = fileInput.getAttribute('data-target-folder');
        const targetFolder = getTargetFolder(targetFolderName);

        if (targetFolder) {
            const folderContent = targetFolder.querySelector('.folder-content');
            handleFileAddition(folderContent, files);
        }

        // 清除文件輸入，允許重複上傳相同文件
        fileInput.value = '';
    }

    function handleFolderUpload(e) {
        const folderName = prompt('請輸入文件夾名稱：');
        if (isValidFolderName(folderName)) {
            alert('請輸入有效的資料夾名稱。名稱中不得包含 \ / : * ? " < > | 等非法字元，也不得為空白。');
        } else if (getTargetFolder(folderName)) {
            alert('資料夾名稱不可重複，請輸入一個新的名稱。');
        } else {
            createFolder(folderName);
            uploadFolder(folderName);
        }
    }

    function toggleDeleteMode() {
        deleteMode = !deleteMode;
        if (deleteMode) {
            deleteBtn.style.backgroundColor = '#d32f2f';
            deleteBtn.classList.add('fullWidth');
            createFolderBtn.style.display = 'none';
        } else {
            deleteBtn.style.backgroundColor = '#f44336';
            deleteBtn.classList.remove('fullWidth');
            createFolderBtn.style.display = 'block';
        }
        folderContainer.style.cursor = deleteMode ? 'not-allowed' : 'default';
    }

    function isValidFolderName(folderName) {
        const invalidChars = /[\\/:*?"<>|]/;
        // 檢查字串是否包含非法字元，且不可以是空白字串或僅包含空格
        return (invalidChars.test(folderName) || folderName.trim() === '');
    }
    
    function getTargetFolder(targetFolderName) {
        return Array.from(folderContainer.children).find(
            folder => folder.querySelector('.folder-header span').textContent === targetFolderName
        );
    }
    
    function getTargetFile(folderContent, targetFileName) {
        return Array.from(folderContent.children).find(
            file => file.innerHTML === targetFileName
        );
    }

    function toggleFolder(e) {
        if (e.target.classList.contains('upload-btn')) return;
        // 獲取最近的 folder-header 元素
        const header = e.target.closest('.folder-header');
        // 如果找不到 folder-header，直接返回
        if (!header) return;
        const content = header.nextElementSibling;
        header.classList.toggle('open');
        content.style.display = content.style.display !== 'block' ? 'block' : 'none';
    }
    
    function handleFileAddition(folderContent, files) {
        const folderName = folderContent.parentNode.querySelector('.folder-header span').textContent;
        for (let file of files) {
            if (getTargetFile(folderContent, file.name)) {
                if (confirm(`資料夾 "${folderName}" 已有一個名為 "${file.name}" 的檔案，是否確定要覆蓋？`)) {
                    console.log("用戶選擇覆蓋檔案。");
                } else {
                    console.log("用戶選擇取消操作。");
                    continue;
                }
            } else {
                const fileElement = document.createElement('div');
                fileElement.className = 'file-link';
                fileElement.draggable = true;
                fileElement.textContent = file.name;
                folderContent.appendChild(fileElement);
            }
            uploadFile(folderName, file);
        }
    }
    
    function createFolder(name, fileNames = []) {
        const folder = document.createElement('div');
        folder.className = 'folder';
        folder.innerHTML = `
            <div class="folder-header">
                <span>${name}</span>
                <button class="upload-btn" title="上傳文件">+</button>
            </div>
            <div class="folder-content"></div>
        `;
        folder.addEventListener('dragover', dragOver);
        folder.addEventListener('dragleave', dragLeave);
        folder.addEventListener('drop', drop);
        folderContainer.appendChild(folder);
    
        const folderHeader = folder.querySelector('.folder-header');
        folderHeader.addEventListener('click', toggleFolder);
    
        const uploadBtn = folder.querySelector('.upload-btn');
        uploadBtn.addEventListener('click', (e) => {
            e.stopPropagation();  // 防止觸發文件夾的折疊/展開
            fileInput.click();
            fileInput.setAttribute('data-target-folder', name);
        });

        const folderContent = folder.querySelector('.folder-content');
        for (let fileName of fileNames) {
            const fileElement = document.createElement('div');
            fileElement.className = 'file-link';
            fileElement.draggable = true;
            fileElement.textContent = fileName;
            folderContent.appendChild(fileElement);
        }
    }
    
    function setFolders() {
        folderContainer.innerHTML = '';
        folderList.forEach(folder => {
            createFolder(folder.name, folder.fileNames);
        });
    }

    function setProgress() {
        const progressBar = document.getElementById('progressBar');
        const progressText = document.getElementById('progressText');
        const startPauseBtn = document.getElementById('startPauseBtn');
        const refreshBtn = document.getElementById('refreshBtn');
        const value = progressObject.value;
        const max = progressObject.max;
        const isProcessing = progressObject.isProcessing;
        progressBar.value = value;
        progressBar.max = max;
        progressBar.innerHTML = `${value}/${max}`;
        progressText.textContent = `文件處理進度: ${value}/${max}`;
        startPauseBtn.disabled = false;
        
        if (isProcessing) {
            startPauseBtn.classList.add('paused');
            startPauseBtn.textContent = '暫停';
        } else {
            startPauseBtn.classList.remove('paused');
            if (value === max) {
                startPauseBtn.textContent = '完成';
                startPauseBtn.disabled = true;
            } else if (value === 0) {
                startPauseBtn.textContent = '開始';
            } else {
                startPauseBtn.textContent = '繼續';
            }
        }

        startPauseBtn.onclick = (event) => {
            // 需要實現與後端的進度控制邏輯
            console.log(event.target);
        };

        refreshBtn.onclick = (event) => {
            fetchProgressObject();
        };
    }

    function uploadFolder(folderName) {
        fetch(`${API_BASE_URL}/upload/${folderName}`).then(response => response.json())
        .catch(error => console.error('Error upload Folders:', error));
    }

    function uploadFile(folderName, file) {
        const formData = new FormData();
        formData.append('file', file);
        snackbar.innerText = "上傳中";
        snackbar.className = "show";
        fetch(`${API_BASE_URL}/upload/${folderName}`, {
            method: 'POST',
            body: formData
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                console.log('上傳成功:', data.filename);
                showSnackbar('success');
            } else {
                throw new Error(data.error || '上傳失敗');
            }
        })
        .catch(error => {
            console.error('Error upload File:', error);
            showSnackbar('error');
        });
    }
    
    function moveFile(fileName, sourceFolder, targetFolder) {
        const data = {
            file_name: fileName,
            source_folder: sourceFolder,
            target_folder: targetFolder
        };
        fetch(`${API_BASE_URL}/move`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        })
        .then(response =>  response.json())
        .then(data => {
            if (data.success) {
                console.log('移動成功:', data.filename);
            } else {
                throw new Error(data.error || '移動失敗');
            }
        })
        .catch(error => {
            console.error('Error move File:', error);
            showSnackbar('error');
        });
    }

    function fetchFolders() {
        fetch(`${API_BASE_URL}/folders`).then(response => response.json())
        .then((folders) => {
            folderList = folders;
            setFolders();
        }).catch(error => {
            console.error('Error fetching Folders:', error);
            showSnackbar('offline');
        });
    }

    function fetchProgressObject() {
        fetch(`${API_BASE_URL}/progress`).then(response => response.json())
        .then((progress) => {
            progressObject = progress;
            setProgress();
        }).catch(error => {
            console.error('Error fetching Progress:', error);
            showSnackbar('offline');
        });
    }

    function closeBackend() {
        fetch(`${API_BASE_URL}/terminate`, { method: 'POST' });
        settingsDialog.close();
        showSnackbar('offline');
    }

    function showSnackbar(type) {
        if (type === 'offline') {
            snackbar.innerText = "後端已離線";
            snackbar.className = "offline";
            return;
        } else if (type === 'success') {
            snackbar.innerText = "上傳成功";
            snackbar.className = "show success";
        } else if (type === 'error') {
            snackbar.innerText = "上傳失敗";
            snackbar.className = "show error";
        }
    
        setTimeout(function() { 
            snackbar.className = snackbar.className = "";
        }, 3000);
    }
});