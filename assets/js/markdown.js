/**
 * Markdown 渲染器
 * 使用 marked.js 渲染 Markdown 文檔
 */

const MarkdownRenderer = {
    /**
     * 初始化 marked 配置
     */
    init() {
        if (typeof marked === 'undefined') {
            console.error('Marked.js not loaded');
            return;
        }

        // 配置 marked
        marked.setOptions({
            highlight: function(code, lang) {
                if (typeof hljs !== 'undefined' && lang && hljs.getLanguage(lang)) {
                    try {
                        return hljs.highlight(code, { language: lang }).value;
                    } catch (e) {
                        console.error('Highlight error:', e);
                    }
                }
                return code;
            },
            breaks: true,
            gfm: true
        });
    },

    /**
     * 渲染 Markdown 文件
     */
    async renderFile(filePath, targetElement) {
        if (!targetElement) {
            console.error('Target element not found');
            return;
        }

        try {
            // 顯示載入狀態
            targetElement.innerHTML = `
                <div class="loading-spinner">
                    <div class="spinner"></div>
                    <p>載入中...</p>
                </div>
            `;

            // 獲取 Markdown 文件
            const response = await fetch(filePath);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const markdown = await response.text();
            
            // 渲染 Markdown
            const html = marked.parse(markdown);
            targetElement.innerHTML = html;

            // 處理內部連結
            this.processLinks(targetElement);

            // 添加代碼複製按鈕
            this.addCopyButtons(targetElement);

            // 觸發語法高亮
            if (typeof hljs !== 'undefined') {
                targetElement.querySelectorAll('pre code').forEach((block) => {
                    hljs.highlightElement(block);
                });
            }

        } catch (error) {
            console.error('Error rendering markdown:', error);
            targetElement.innerHTML = `
                <div class="error-message">
                    <h3>載入失敗</h3>
                    <p>無法載入文檔: ${filePath}</p>
                    <p class="error-detail">${error.message}</p>
                </div>
            `;
        }
    },

    /**
     * 處理文檔內的連結
     */
    processLinks(container) {
        container.querySelectorAll('a').forEach(link => {
            const href = link.getAttribute('href');
            
            // 外部連結在新標籤開啟
            if (href && href.startsWith('http')) {
                link.setAttribute('target', '_blank');
                link.setAttribute('rel', 'noopener noreferrer');
                link.innerHTML += ' <span class="external-link-icon">↗</span>';
            }
        });
    },

    /**
     * 為代碼塊添加複製按鈕
     */
    addCopyButtons(container) {
        container.querySelectorAll('pre code').forEach((codeBlock) => {
            const pre = codeBlock.parentElement;
            
            // 創建複製按鈕
            const button = document.createElement('button');
            button.className = 'copy-code-btn';
            button.innerHTML = '複製';
            button.setAttribute('aria-label', '複製程式碼');
            
            button.addEventListener('click', async () => {
                const code = codeBlock.textContent;
                const success = await Core.copyToClipboard(code);
                
                if (success) {
                    button.innerHTML = '✓ 已複製';
                    button.classList.add('copied');
                    setTimeout(() => {
                        button.innerHTML = '複製';
                        button.classList.remove('copied');
                    }, 2000);
                } else {
                    button.innerHTML = '✗ 失敗';
                    setTimeout(() => {
                        button.innerHTML = '複製';
                    }, 2000);
                }
            });
            
            pre.style.position = 'relative';
            pre.appendChild(button);
        });
    },

    /**
     * 生成目錄
     */
    generateTOC(container, targetElement) {
        if (!container || !targetElement) return;

        const headings = container.querySelectorAll('h1, h2, h3, h4');
        if (headings.length === 0) return;

        const tocList = document.createElement('ul');
        tocList.className = 'toc-list';

        headings.forEach((heading, index) => {
            // 為標題添加 ID
            if (!heading.id) {
                heading.id = `heading-${index}`;
            }

            const level = parseInt(heading.tagName.substring(1));
            const item = document.createElement('li');
            item.className = `toc-item toc-level-${level}`;
            
            const link = document.createElement('a');
            link.href = `#${heading.id}`;
            link.textContent = heading.textContent;
            link.addEventListener('click', (e) => {
                e.preventDefault();
                heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
            
            item.appendChild(link);
            tocList.appendChild(item);
        });

        targetElement.innerHTML = '<h3>目錄</h3>';
        targetElement.appendChild(tocList);
    },

    /**
     * 渲染多個文檔（用於多標籤頁）
     */
    async renderMultiple(docs, containerSelector) {
        const container = document.querySelector(containerSelector);
        if (!container) return;

        // 創建標籤導航
        const tabs = document.createElement('div');
        tabs.className = 'doc-tabs';
        
        const contentContainer = document.createElement('div');
        contentContainer.className = 'doc-content';

        docs.forEach((doc, index) => {
            // 創建標籤按鈕
            const tab = document.createElement('button');
            tab.className = `doc-tab ${index === 0 ? 'active' : ''}`;
            tab.textContent = doc.title;
            tab.addEventListener('click', () => {
                // 切換活動標籤
                tabs.querySelectorAll('.doc-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                // 載入對應文檔
                this.renderFile(doc.path, contentContainer);
            });
            tabs.appendChild(tab);
        });

        container.appendChild(tabs);
        container.appendChild(contentContainer);

        // 載入第一個文檔
        if (docs.length > 0) {
            await this.renderFile(docs[0].path, contentContainer);
        }
    },

    /**
     * 搜尋功能
     */
    addSearch(container, searchInputSelector) {
        const searchInput = document.querySelector(searchInputSelector);
        if (!searchInput || !container) return;

        searchInput.addEventListener('input', Core.debounce((e) => {
            const query = e.target.value.toLowerCase();
            const content = container.textContent.toLowerCase();
            
            if (!query) {
                // 清除高亮
                container.querySelectorAll('.search-highlight').forEach(el => {
                    el.outerHTML = el.textContent;
                });
                return;
            }

            // 高亮搜尋結果
            const regex = new RegExp(`(${query})`, 'gi');
            const walker = document.createTreeWalker(
                container,
                NodeFilter.SHOW_TEXT,
                null,
                false
            );

            const textNodes = [];
            while (walker.nextNode()) {
                textNodes.push(walker.currentNode);
            }

            textNodes.forEach(node => {
                if (node.textContent.toLowerCase().includes(query)) {
                    const span = document.createElement('span');
                    span.innerHTML = node.textContent.replace(regex, '<mark class="search-highlight">$1</mark>');
                    node.parentNode.replaceChild(span, node);
                }
            });
        }, 300));
    }
};

// 導出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MarkdownRenderer;
}
