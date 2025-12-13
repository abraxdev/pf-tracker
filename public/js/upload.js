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

        // Completa l'ultimo step
        updateStep('saving', 'complete');

        // Attendi un attimo prima di nascondere la progress
        await new Promise(resolve => setTimeout(resolve, 800));

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
        <div id="upload-progress" class="mt-6 animate-slideIn upload-progress-card">
            <div class="flex items-center justify-between mb-4">
                <h4 class="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <svg class="w-6 h-6 text-primary animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                    </svg>
                    Elaborazione in corso
                </h4>
                <span class="text-sm font-medium text-gray-600">Attendere...</span>
            </div>

            <!-- Progress bar animata -->
            <div class="progress-bar-indeterminate mb-6"></div>

            <!-- Steps progressivi -->
            <div class="space-y-3">
                <div class="upload-step" id="step-parsing">
                    <div class="upload-step-icon active" id="icon-parsing">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                        </svg>
                    </div>
                    <div class="flex-1">
                        <p class="font-medium text-gray-900" id="text-parsing">Analisi file e estrazione dati...</p>
                        <p class="text-xs text-gray-500">Lettura e parsing dei file bancari</p>
                    </div>
                </div>

                <div class="upload-step" id="step-classification">
                    <div class="upload-step-icon pending" id="icon-classification">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
                        </svg>
                    </div>
                    <div class="flex-1">
                        <p class="font-medium text-gray-500" id="text-classification">Classificazione AI delle transazioni</p>
                        <p class="text-xs text-gray-400">Categorizzazione automatica con Claude</p>
                    </div>
                </div>

                <div class="upload-step" id="step-saving">
                    <div class="upload-step-icon pending" id="icon-saving">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"></path>
                        </svg>
                    </div>
                    <div class="flex-1">
                        <p class="font-medium text-gray-500" id="text-saving">Salvataggio nel database</p>
                        <p class="text-xs text-gray-400">Archiviazione sicura dei dati</p>
                    </div>
                </div>
            </div>

            <!-- Info aggiuntiva -->
            <div class="mt-4 pt-4 border-t border-blue-200">
                <p class="text-xs text-gray-600 text-center">
                    Questo processo può richiedere anche alcuni minuti per file complessi
                </p>
            </div>
        </div>
    `;
    fileList.insertAdjacentHTML('afterend', progressHtml);

    // Simula il progresso degli step (sarà sostituito con eventi reali se disponibili)
    simulateProgress();
}

function simulateProgress() {
    // Step 1: Parsing (già attivo)
    setTimeout(() => {
        updateStep('parsing', 'complete');
        updateStep('classification', 'active');
    }, 2000);

    // Step 2: Classification
    setTimeout(() => {
        updateStep('classification', 'complete');
        updateStep('saving', 'active');
    }, 5000);

    // Step 3 sarà completato quando la richiesta HTTP finisce
}

function updateStep(step, status) {
    const icon = document.getElementById(`icon-${step}`);
    const text = document.getElementById(`text-${step}`);

    if (!icon || !text) return;

    // Rimuovi tutte le classi di stato
    icon.classList.remove('pending', 'active', 'complete');

    // Aggiungi la nuova classe
    icon.classList.add(status);

    // Aggiorna il colore del testo
    if (status === 'complete') {
        text.classList.remove('text-gray-500');
        text.classList.add('text-gray-900');

        // Cambia icona a checkmark
        icon.innerHTML = `
            <svg class="w-5 h-5 animate-checkmark" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path>
            </svg>
        `;
    } else if (status === 'active') {
        text.classList.remove('text-gray-500');
        text.classList.add('text-gray-900');
    }
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
