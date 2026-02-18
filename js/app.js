// Script Management System with Category Protection
class AutomationHub {
    constructor() {
        this.scripts = JSON.parse(localStorage.getItem('scripts')) || this.getDefaultScripts();
        this.currentScript = null;
        
        // Category protection keys
        this.categoryKeys = {
            'scheduler': 'SCHED2024!',
            'utility': 'UTIL2024!',
            'email': 'EMAIL2024!'
        };
        
        // Track unlocked categories in session
        this.unlockedCategories = new Set();
        
        this.init();
    }

    getDefaultScripts() {
        return [];
    }

    async loadDefaultScripts() {
        const defaultsLoaded = localStorage.getItem('defaultsLoaded');
        if (defaultsLoaded) return;

        const defaultConfigs = [
            {
                id: 'dayshift',
                file: 'Dayshift.txt',
                name: 'Day Shift Scheduler',
                category: 'scheduler',
                description: 'Automated presence status scheduler for day shift operations (10:30 AM - 4:00 PM)'
            },
            {
                id: 'nightshift',
                file: 'NightShift7.txt',
                name: 'Night Shift Scheduler',
                category: 'scheduler',
                description: 'Evening shift automation with multiple queue toggles and break scheduling'
            },
            {
                id: 'thirdshift',
                file: 'ThirdShift.txt',
                name: 'Third Shift Scheduler',
                category: 'scheduler',
                description: 'Late night shift covering 4:00 PM - 1:00 AM with extended coverage'
            },
            {
                id: 'wfh-email',
                file: 'WFH_Email.txt',
                name: 'WFH Email Automation',
                category: 'email',
                description: 'Outlook email automation with send functionality for work-from-home notifications'
            },
            {
                id: 'autorefresh',
                file: 'AutoRefresh.txt',
                name: 'Auto Page Refresh',
                category: 'utility',
                description: 'Automatic page refresh utility with countdown timer and manual trigger'
            }
        ];

        for (const config of defaultConfigs) {
            try {
                const response = await fetch(config.file);
                if (response.ok) {
                    const content = await response.text();
                    const exists = this.scripts.find(s => s.id === config.id);
                    if (!exists) {
                        this.scripts.push({
                            id: config.id,
                            name: config.name,
                            category: config.category,
                            description: config.description,
                            filename: config.file,
                            content: content,
                            size: (content.length / 1024).toFixed(1) + ' KB',
                            updated: new Date().toISOString(),
                            version: '1.0'
                        });
                    }
                }
            } catch (e) {
                console.error('Failed to load:', config.file);
            }
        }

        localStorage.setItem('defaultsLoaded', 'true');
        this.saveScripts();
    }

    async init() {
        await this.loadDefaultScripts();
        this.renderScripts();
        this.updateStats();
        this.setupEventListeners();
        this.setupDragAndDrop();
        this.updateFilterButtons();
    }

    setupEventListeners() {
        // Filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const filter = e.target.dataset.filter;
                
                if (filter !== 'all' && !this.isCategoryUnlocked(filter)) {
                    const unlocked = await this.promptForCategoryKey(filter);
                    if (!unlocked) return;
                }
                
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.renderScripts(filter);
            });
        });

        // File input
        const fileInput = document.getElementById('fileInput');
        fileInput.addEventListener('change', (e) => this.handleFileSelect(e.target.files[0]));

        // Cancel upload
        document.getElementById('cancelUpload').addEventListener('click', () => {
            document.getElementById('uploadForm').style.display = 'none';
            document.querySelector('.upload-content').style.display = 'block';
        });

        // Confirm upload
        document.getElementById('confirmUpload').addEventListener('click', () => this.confirmUpload());

        // Modal actions
        document.getElementById('closeModal').addEventListener('click', () => this.closeModal());
        document.getElementById('copyScript').addEventListener('click', () => this.copyScript());
        document.getElementById('deleteScript').addEventListener('click', () => this.deleteScript());
        document.getElementById('replaceScript').addEventListener('click', () => this.replaceScript());

        // Close modal on outside click
        document.getElementById('scriptModal').addEventListener('click', (e) => {
            if (e.target.id === 'scriptModal') this.closeModal();
        });
    }

    setupDragAndDrop() {
        const uploadArea = document.getElementById('uploadArea');

        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            uploadArea.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            uploadArea.addEventListener(eventName, () => {
                uploadArea.classList.add('dragover');
            });
        });

        ['dragleave', 'drop'].forEach(eventName => {
            uploadArea.addEventListener(eventName, () => {
                uploadArea.classList.remove('dragover');
            });
        });

        uploadArea.addEventListener('drop', (e) => {
            const file = e.dataTransfer.files[0];
            if (file && (file.name.endsWith('.js') || file.name.endsWith('.txt'))) {
                this.handleFileSelect(file);
            } else {
                this.showToast('Please upload a .js or .txt file', 'error');
            }
        });
    }

    async promptForCategoryKey(category) {
        const categoryNames = {
            'scheduler': 'Scheduler',
            'utility': 'Utility',
            'email': 'Email'
        };
        
        const key = prompt(
            `🔒 ${categoryNames[category]} Scripts are protected.\n\n` +
            `Please enter the access key for ${categoryNames[category]} category:`
        );
        
        if (key === null) return false;
        
        if (key === this.categoryKeys[category]) {
            this.unlockedCategories.add(category);
            this.showToast(`${categoryNames[category]} category unlocked!`, 'success');
            this.updateFilterButtons();
            this.renderScripts(document.querySelector('.filter-btn.active').dataset.filter);
            return true;
        } else {
            this.showToast('Incorrect key! Access denied.', 'error');
            return false;
        }
    }

    isCategoryUnlocked(category) {
        if (category === 'all') return true;
        return this.unlockedCategories.has(category);
    }

    updateFilterButtons() {
        document.querySelectorAll('.filter-btn').forEach(btn => {
            const filter = btn.dataset.filter;
            const baseText = filter.charAt(0).toUpperCase() + filter.slice(1);
            
            if (filter !== 'all' && !this.isCategoryUnlocked(filter)) {
                btn.innerHTML = `<i class="fas fa-lock" style="margin-right: 5px;"></i> ${baseText}`;
            } else {
                btn.textContent = baseText;
            }
        });
    }

    handleFileSelect(file) {
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            this.pendingFile = {
                name: file.name.replace(/\.(js|txt)$/, ''),
                content: e.target.result,
                size: (file.size / 1024).toFixed(1) + ' KB'
            };

            document.querySelector('.upload-content').style.display = 'none';
            document.getElementById('uploadForm').style.display = 'block';
            document.getElementById('scriptName').value = this.pendingFile.name;
        };
        reader.readAsText(file);
    }

    confirmUpload() {
        const name = document.getElementById('scriptName').value;
        const category = document.getElementById('scriptCategory').value;
        const description = document.getElementById('scriptDescription').value;

        if (!name || !description) {
            this.showToast('Please fill in all fields', 'error');
            return;
        }

        const existingIndex = this.scripts.findIndex(s => 
            s.name.toLowerCase() === name.toLowerCase()
        );

        const newScript = {
            id: existingIndex >= 0 ? this.scripts[existingIndex].id : Date.now().toString(),
            name: name,
            category: category,
            description: description,
            filename: name.replace(/\s+/g, '') + '.txt',
            content: this.pendingFile.content,
            size: this.pendingFile.size,
            updated: new Date().toISOString(),
            version: existingIndex >= 0 ? 
                (parseFloat(this.scripts[existingIndex].version) + 0.1).toFixed(1) : '1.0'
        };

        if (existingIndex >= 0) {
            this.scripts[existingIndex] = newScript;
            this.showToast(`Script "${name}" updated to v${newScript.version}`, 'success');
        } else {
            this.scripts.push(newScript);
            this.showToast(`Script "${name}" uploaded successfully`, 'success');
        }

        this.saveScripts();
        this.renderScripts();
        this.updateStats();

        document.getElementById('uploadForm').style.display = 'none';
        document.querySelector('.upload-content').style.display = 'block';
        document.getElementById('scriptName').value = '';
        document.getElementById('scriptDescription').value = '';
        this.pendingFile = null;
    }

    renderScripts(filter = 'all') {
        const grid = document.getElementById('scriptsGrid');
        const filtered = filter === 'all' ? 
            this.scripts : 
            this.scripts.filter(s => s.category === filter);

        grid.innerHTML = filtered.map(script => {
            const isLocked = !this.isCategoryUnlocked(script.category);
            const lockIcon = isLocked ? '<i class="fas fa-lock" style="color: #ef4444; margin-left: 8px;"></i>' : '';
            
            return `
                <div class="script-card" onclick="hub.openScript('${script.id}')">
                    <div class="script-header">
                        <div class="script-icon">
                            <i class="fas ${this.getIcon(script.category)}"></i>
                        </div>
                        <span class="script-badge ${script.category}">${script.category}</span>
                    </div>
                    <h3 class="script-title">
                        ${script.name}
                        ${lockIcon}
                    </h3>
                    <p class="script-description">${script.description}</p>
                    <div class="script-meta">
                        <span><i class="fas fa-file"></i> ${script.size}</span>
                        <span><i class="fas fa-code-branch"></i> v${script.version}</span>
                        <span><i class="fas fa-clock"></i> ${this.timeAgo(script.updated)}</span>
                    </div>
                    <div class="script-actions">
                        <button class="btn-secondary" onclick="event.stopPropagation(); hub.downloadScript('${script.id}')">
                            <i class="fas fa-download"></i> Download
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    getIcon(category) {
        const icons = {
            scheduler: 'fa-clock',
            email: 'fa-envelope',
            utility: 'fa-tools'
        };
        return icons[category] || 'fa-code';
    }

    timeAgo(date) {
        const seconds = Math.floor((new Date() - new Date(date)) / 1000);
        const intervals = {
            year: 31536000,
            month: 2592000,
            week: 604800,
            day: 86400,
            hour: 3600,
            minute: 60
        };

        for (const [unit, secondsInUnit] of Object.entries(intervals)) {
            const interval = Math.floor(seconds / secondsInUnit);
            if (interval >= 1) {
                return `${interval} ${unit}${interval > 1 ? 's' : ''} ago`;
            }
        }
        return 'Just now';
    }

    async openScript(id) {
        this.currentScript = this.scripts.find(s => s.id === id);
        if (!this.currentScript) return;
        
        if (!this.isCategoryUnlocked(this.currentScript.category)) {
            const unlocked = await this.promptForCategoryKey(this.currentScript.category);
            if (!unlocked) return;
        }
        
        document.getElementById('modalTitle').textContent = this.currentScript.name;
        document.getElementById('codeContent').innerHTML = this.syntaxHighlight(this.currentScript.content);
        document.getElementById('scriptModal').classList.add('active');
    }

    syntaxHighlight(code) {
        return code
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/(".*?"|'.*?')/g, '<span class="string">$1</span>')
            .replace(/\b(const|let|var|function|return|if|else|for|while|class|new|this|async|await)\b/g, '<span class="keyword">$1</span>')
            .replace(/\b(\d+)\b/g, '<span class="number">$1</span>')
            .replace(/(\/\/.*$|\/\*[\s\S]*?\*\/)/gm, '<span class="comment">$1</span>')
            .replace(/\b([a-zA-Z_]\w*)\s*(?=\()/g, '<span class="function">$1</span>');
    }

    closeModal() {
        document.getElementById('scriptModal').classList.remove('active');
        this.currentScript = null;
    }

    copyScript() {
        if (!this.currentScript) return;
        navigator.clipboard.writeText(this.currentScript.content);
        this.showToast('Code copied to clipboard!', 'success');
    }

    deleteScript() {
        if (!this.currentScript) return;
        if (confirm(`Are you sure you want to delete "${this.currentScript.name}"?`)) {
            this.scripts = this.scripts.filter(s => s.id !== this.currentScript.id);
            this.saveScripts();
            this.renderScripts();
            this.updateStats();
            this.closeModal();
            this.showToast('Script deleted successfully', 'success');
        }
    }

    replaceScript() {
        this.closeModal();
        document.getElementById('uploadArea').scrollIntoView({ behavior: 'smooth' });
        document.getElementById('scriptName').value = this.currentScript.name;
        document.getElementById('scriptCategory').value = this.currentScript.category;
        document.getElementById('scriptDescription').value = this.currentScript.description;
        
        this.pendingFile = {
            name: this.currentScript.name,
            content: this.currentScript.content,
            size: this.currentScript.size
        };
        
        document.querySelector('.upload-content').style.display = 'none';
        document.getElementById('uploadForm').style.display = 'block';
    }

async downloadScript(id) {
    const script = this.scripts.find(s => s.id === id);
    if (!script) return;
    
    // Check if category is locked before downloading
    if (!this.isCategoryUnlocked(script.category)) {
        const unlocked = await this.promptForCategoryKey(script.category);
        if (!unlocked) return; // Don't download if denied
    }

    const blob = new Blob([script.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = script.filename;
    a.click();
    URL.revokeObjectURL(url);
    
    this.showToast(`Downloaded ${script.filename}`, 'success');
}

    updateStats() {
        document.getElementById('totalScripts').textContent = this.scripts.length;
        document.getElementById('activeSchedules').textContent = 
            this.scripts.filter(s => s.category === 'scheduler').length;
        document.getElementById('totalRuns').textContent = 
            Math.floor(Math.random() * 1000) + 500;
    }

    saveScripts() {
        localStorage.setItem('scripts', JSON.stringify(this.scripts));
    }

    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            info: 'fa-info-circle'
        };
        
        toast.innerHTML = `
            <i class="fas ${icons[type]}"></i>
            <span>${message}</span>
        `;
        
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
}

// Initialize
const hub = new AutomationHub();

// Smooth scroll for navigation
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });
});
