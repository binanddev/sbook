// JavaScript cho Web đọc truyện
class StoryReader {
    constructor() {
        this.stories = this.parseStories();
        this.currentStoryIndex = 0;
        this.isDarkMode = localStorage.getItem('darkMode') === 'true';
        this.translationCache = new Map();
        this.vocabMap = new Map(); // normalizedWord -> meaning
        this.ipaCache = new Map(); // normalizedWord -> ipa
        this.vocabLoadedPromise = this.loadVocabulary();
        
        this.tooltip = document.getElementById('translation-tooltip');
        this.highlightedWord = null;

        this.init();
    }

    // Hàm chuẩn hóa từ, dùng chung cho cả nạp và tra cứu
    normalizeWord(word) {
        if (!word) return '';
        return word.trim().toLowerCase().replace(/[^a-z'’-]/g, '');
    }

    parseStories() {
        const storyText = document.querySelector('.story-text').textContent;
        const stories = [];
        const storyParts = storyText.split(/(?=\d+\.)/);
        
        storyParts.forEach((part, index) => {
            if (part.trim()) {
                const lines = part.trim().split('\n');
                const title = lines[0].trim();
                const content = lines.slice(1).join('\n').trim();
                
                if (title && content) {
                    stories.push({ id: index, title: title, content: content });
                }
            }
        });
        
        return stories;
    }

    init() {
        this.setupTheme();
        this.setupNavigation();
        this.setupWordTranslation();
        // **KHÔI PHỤC LẠI VIỆC GỌI HÀM DỊCH CÂU**
        this.setupSentenceTranslation();
        this.loadStory(0);
        
        document.addEventListener('click', (e) => {
            if (this.highlightedWord && !this.highlightedWord.contains(e.target) && !this.tooltip.contains(e.target)) {
                this.hideWordTranslation();
            }
        });
    }
    
    setupTheme() {
        const themeToggle = document.getElementById('themeToggle');
        const body = document.body;
        
        if (this.isDarkMode) {
            body.classList.add('dark-mode');
            themeToggle.innerHTML = '<i class="bi bi-sun"></i> Sáng';
        } else {
            body.classList.remove('dark-mode');
            themeToggle.innerHTML = '<i class="bi bi-moon"></i> Tối';
        }
        
        themeToggle.addEventListener('click', () => {
            this.isDarkMode = !this.isDarkMode;
            
            if (this.isDarkMode) {
                body.classList.add('dark-mode');
                themeToggle.innerHTML = '<i class="bi bi-sun"></i> Sáng';
            } else {
                body.classList.remove('dark-mode');
                themeToggle.innerHTML = '<i class="bi bi-moon"></i> Tối';
            }
            
            localStorage.setItem('darkMode', this.isDarkMode);
        });
    }

    setupNavigation() {
        const navContainer = document.querySelector('.story-nav');
        navContainer.innerHTML = ''; 
        this.stories.forEach((story, index) => {
            const button = document.createElement('button');
            button.className = 'btn btn-outline-secondary me-2 mb-2';
            button.textContent = story.title.replace(/^\d+\.\s*/, '');
            button.addEventListener('click', () => this.loadStory(index));
            navContainer.appendChild(button);
        });
        
        this.updateActiveButton();
    }

    loadStory(index) {
        if (index >= 0 && index < this.stories.length) {
            this.currentStoryIndex = index;
            const story = this.stories[index];
            
            document.querySelector('.story-title').textContent = story.title.replace(/^\d+\.\s*/, '');
            
            const storyText = document.querySelector('.story-text');
            storyText.innerHTML = this.formatStoryContent(story.content);
            
            this.updateActiveButton();
        }
    }

    formatStoryContent(content) {
        return content
            .split('\n')
            .filter(p => p.trim() !== '')
            .map(paragraph => {
                const formattedWords = paragraph.trim().split(/\s+/).map(word => {
                    const normalized = this.normalizeWord(word);
                    if (!normalized) return `<span>${word}</span>`;
                    return `<span class="word" data-word="${normalized}">${word}</span>`;
                }).join(' ');
                return `<p>${formattedWords}</p>`;
            }).join('');
    }

    updateActiveButton() {
        const buttons = document.querySelectorAll('.story-nav button');
        buttons.forEach((btn, index) => {
            if (index === this.currentStoryIndex) {
                btn.classList.add('active', 'btn-primary');
                btn.classList.remove('btn-outline-secondary');
            } else {
                btn.classList.remove('active', 'btn-primary');
                btn.classList.add('btn-outline-secondary');
            }
        });
    }

    setupWordTranslation() {
        const storyContainer = document.querySelector('.story-text');
        storyContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('word')) {
                this.translateWord(e.target);
            }
        });
    }

    async loadVocabulary() {
        try {
            const res = await fetch('vocabulary.json');
            if (!res.ok) throw new Error('Không tìm thấy file vocabulary.json');
            const data = await res.json();
            this.ingestVocabulary(data);
        } catch (error) {
            console.error(error);
            alert('Lỗi: Không thể tải file từ vựng. Vui lòng đảm bảo file `vocabulary.json` tồn tại và đúng định dạng.');
        }
    }

    ingestVocabulary(data) {
        if (!Array.isArray(data)) return;
        for (const entry of data) {
            if (entry && entry.word) {
                const norm = this.normalizeWord(entry.word);
                if (norm) {
                    this.vocabMap.set(norm, entry.meaning);
                    this.ipaCache.set(norm, entry.ipa);
                }
            }
        }
    }

    async translateWord(wordElement) {
        if (this.highlightedWord) {
            this.hideWordTranslation();
        }

        const word = wordElement.dataset.word;
        if (!word) return;

        this.highlightedWord = wordElement;
        wordElement.classList.add('word-highlight');

        const translation = await this.getWordTranslation(word);
        
        if (wordElement === this.highlightedWord) {
            this.showWordTranslation(wordElement, translation);
        }
    }

    async getWordTranslation(word) {
        await this.vocabLoadedPromise;
        const meaning = this.vocabMap.get(word) || 'Không tìm thấy trong từ điển.';
        const ipa = this.ipaCache.get(word) || '/?/';
        return { meaning, ipa };
    }

    showWordTranslation(wordElement, translation) {
        if (!this.tooltip) return;

        this.tooltip.innerHTML = `
            <div class="word">${wordElement.dataset.word}</div>
            <div class="ipa">${translation.ipa}</div>
            <div class="meaning">${translation.meaning}</div>
        `;

        const wordRect = wordElement.getBoundingClientRect();
        this.tooltip.style.left = `${wordRect.left + window.scrollX}px`;
        this.tooltip.style.top = `${wordRect.bottom + window.scrollY + 5}px`;

        this.tooltip.classList.add('show');
    }

    hideWordTranslation() {
        if (this.highlightedWord) {
            this.highlightedWord.classList.remove('word-highlight');
            this.highlightedWord = null;
        }
        if (this.tooltip) {
            this.tooltip.classList.remove('show');
        }
    }

    // --- KHÔI PHỤC TÍNH NĂNG DỊCH CÂU ---

    setupSentenceTranslation() {
        const storyText = document.querySelector('.story-text');
        
        storyText.addEventListener('mouseup', (e) => {
            const selection = window.getSelection();
            const selectedText = selection.toString().trim();
            
            // Chỉ dịch câu nếu có nhiều hơn 1 từ
            if (selectedText.length > 0 && selectedText.includes(' ')) {
                this.translateSentence(selectedText);
            }
        });
    }

    async translateSentence(sentence) {
        // Tạo modal
        const modal = document.createElement('div');
        modal.className = 'translation-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3 class="modal-title">Dịch câu</h3>
                    <button class="close-btn">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="original-text">
                        <strong>Tiếng Anh:</strong><br>
                        ${sentence}
                    </div>
                    <div class="translated-text">
                        <strong>Tiếng Việt:</strong><br>
                        <span class="loading"></span> Đang dịch...
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        setTimeout(() => modal.classList.add('show'), 10);
        
        const closeBtn = modal.querySelector('.close-btn');
        closeBtn.addEventListener('click', () => this.closeModal(modal));
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeModal(modal);
            }
        });
        
        try {
            const translation = await this.getSentenceTranslation(sentence);
            const translatedText = modal.querySelector('.translated-text');
            translatedText.innerHTML = `
                <strong>Tiếng Việt:</strong><br>
                ${translation}
            `;
        } catch (error) {
            console.error('Translation error:', error);
            const translatedText = modal.querySelector('.translated-text');
            translatedText.innerHTML = `
                <strong>Tiếng Việt:</strong><br>
                Lỗi khi dịch câu này.
            `;
        }
    }

    async getSentenceTranslation(sentence) {
		try {
			const resp = await fetch('https://libretranslate.de/translate', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ q: sentence, source: 'en', target: 'vi', format: 'text' })
			});
			if (resp.ok) {
				const data = await resp.json();
				if (data && data.translatedText) return data.translatedText;
			}
		} catch {}
		return await this.translateViaMyMemory(sentence, 'en', 'vi');
	}

	async translateViaMyMemory(text, source, target) {
		const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(source)}|${encodeURIComponent(target)}`;
		const resp = await fetch(url);
		if (!resp.ok) throw new Error('MyMemory failed');
		const data = await resp.json();
		const translated = data?.responseData?.translatedText;
		if (translated) return translated;
		throw new Error('No translation');
    }

    closeModal(modal) {
        modal.classList.remove('show');
        setTimeout(() => {
            if (document.body.contains(modal)) {
                document.body.removeChild(modal);
            }
        }, 300);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new StoryReader();
});