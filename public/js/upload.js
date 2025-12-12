// Upload page drag and drop functionality

const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const fileList = document.getElementById('file-list');
const uploadBtn = document.getElementById('upload-btn');

let selectedFiles = [];

// Click to select files
dropZone.addEventListener('click', () => {
    fileInput.click();
});

// Prevent default drag behaviors
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, preventDefaults, false);
    document.body.addEventListener(eventName, preventDefaults, false);
});

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

// Highlight drop zone when dragging over
['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => {
        dropZone.classList.add('border-primary', 'bg-blue-50');
    });
});

['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => {
        dropZone.classList.remove('border-primary', 'bg-blue-50');
    });
});

// Handle dropped files
dropZone.addEventListener('drop', (e) => {
    const files = e.dataTransfer.files;
    handleFiles(files);
});

// Handle selected files
fileInput.addEventListener('change', (e) => {
    handleFiles(e.target.files);
});

function handleFiles(files) {
    selectedFiles = Array.from(files);
    displayFileList();
}

function displayFileList() {
    if (selectedFiles.length === 0) {
        fileList.classList.add('hidden');
        uploadBtn.classList.add('hidden');
        return;
    }

    fileList.classList.remove('hidden');
    uploadBtn.classList.remove('hidden');

    const listHTML = selectedFiles.map(file => `
        <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div class="flex items-center">
                <svg class="h-5 w-5 text-gray-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span class="text-sm text-gray-700">${file.name}</span>
                <span class="text-xs text-gray-500 ml-2">(${formatFileSize(file.size)})</span>
            </div>
        </div>
    `).join('');

    fileList.innerHTML = `<h3 class="font-semibold text-gray-900 mb-2">File selezionati:</h3>${listHTML}`;
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// Upload files
uploadBtn.addEventListener('click', async () => {
    if (selectedFiles.length === 0) return;

    // Show loading state
    uploadBtn.disabled = true;
    uploadBtn.innerHTML = `
        <span class="spinner mr-2"></span>
        Processing...
    `;

    // Show progress indicator
    showProgress();

    const formData = new FormData();
    selectedFiles.forEach(file => {
        formData.append('files', file);
    });

    try {
        const response = await fetch('/upload/api', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        // Hide progress
        hideProgress();

        if (result.success) {
            displayResults(result.files);
            // Reset
            selectedFiles = [];
            fileInput.value = '';
            displayFileList();
        } else {
            showError(result.error || 'Errore sconosciuto');
        }
    } catch (error) {
        console.error('Upload error:', error);
        hideProgress();
        showError('Errore durante il caricamento dei file');
    } finally {
        uploadBtn.disabled = false;
        uploadBtn.textContent = 'Carica e Analizza';
    }
});

function showProgress() {
    const progressHtml = `
        <div id="upload-progress" class="mt-4 animate-slideIn">
            <div class="flex items-center justify-between mb-2">
                <span class="text-sm text-gray-700">Elaborazione in corso...</span>
                <span class="text-sm text-gray-500">Attendere</span>
            </div>
            <div class="progress-bar">
                <div class="progress-bar-fill w-full"></div>
            </div>
            <p class="text-xs text-gray-500 mt-2">
                Parsing file → Classificazione AI → Salvataggio database
            </p>
        </div>
    `;
    fileList.insertAdjacentHTML('afterend', progressHtml);
}

function hideProgress() {
    const progress = document.getElementById('upload-progress');
    if (progress) progress.remove();
}

function showError(message) {
    const errorHtml = `
        <div class="alert alert-error mt-4 animate-fadeIn">
            <strong>Errore:</strong> ${message}
        </div>
    `;
    const container = document.querySelector('.max-w-4xl');
    container.insertAdjacentHTML('beforeend', errorHtml);

    setTimeout(() => {
        const alerts = document.querySelectorAll('.alert-error');
        alerts.forEach(alert => alert.remove());
    }, 5000);
}

function displayResults(files) {
    const resultsContainer = document.getElementById('results-container') || createResultsContainer();

    const resultsHTML = files.map(file => {
        if (file.status === 'success') {
            return `
                <div class="border-l-4 border-green-500 bg-green-50 p-4 rounded">
                    <div class="flex items-start">
                        <svg class="h-5 w-5 text-green-500 mt-0.5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
                        </svg>
                        <div class="flex-1">
                            <h4 class="font-semibold text-green-800">${file.name}</h4>
                            <p class="text-sm text-green-700 mt-1">
                                <span class="badge badge-${file.bank}">${file.bank}</span>
                                Importate: ${file.imported} | Duplicati: ${file.duplicates} | Totale: ${file.total}
                            </p>
                        </div>
                    </div>
                </div>
            `;
        } else if (file.status === 'error') {
            return `
                <div class="border-l-4 border-red-500 bg-red-50 p-4 rounded">
                    <div class="flex items-start">
                        <svg class="h-5 w-5 text-red-500 mt-0.5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
                        </svg>
                        <div class="flex-1">
                            <h4 class="font-semibold text-red-800">${file.name}</h4>
                            <p class="text-sm text-red-700 mt-1">${file.error}</p>
                        </div>
                    </div>
                </div>
            `;
        } else {
            return `
                <div class="border-l-4 border-yellow-500 bg-yellow-50 p-4 rounded">
                    <div class="flex items-start">
                        <svg class="h-5 w-5 text-yellow-500 mt-0.5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                        </svg>
                        <div class="flex-1">
                            <h4 class="font-semibold text-yellow-800">${file.name}</h4>
                            <p class="text-sm text-yellow-700 mt-1">${file.message}</p>
                        </div>
                    </div>
                </div>
            `;
        }
    }).join('');

    resultsContainer.innerHTML = `
        <h3 class="font-semibold text-gray-900 mb-4">Risultati Upload</h3>
        <div class="space-y-3">
            ${resultsHTML}
        </div>
        <div class="mt-6 flex gap-4">
            <a href="/transactions" class="btn-primary">Vedi Transazioni</a>
            <a href="/" class="btn-outline">Vai alla Dashboard</a>
        </div>
    `;
    resultsContainer.classList.remove('hidden');
}

function createResultsContainer() {
    const container = document.createElement('div');
    container.id = 'results-container';
    container.className = 'mt-8 card hidden';
    document.querySelector('.max-w-4xl').appendChild(container);
    return container;
}
