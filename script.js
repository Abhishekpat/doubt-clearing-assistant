let courseData = null;
let questionHistory = [];

const stopWords = new Set([
    'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should',
    'could', 'can', 'may', 'might', 'must', 'shall', 'i', 'you', 'he',
    'she', 'it', 'we', 'they', 'what', 'which', 'who', 'when', 'where',
    'why', 'how', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
    'from', 'about', 'into', 'through', 'during', 'before', 'after',
    'above', 'below', 'between', 'under', 'over', 'out', 'up', 'down',
    'and', 'or', 'but', 'if', 'then', 'else', 'this', 'that', 'these',
    'those', 'my', 'your', 'his', 'her', 'its', 'our', 'their', 'me',
    'him', 'her', 'us', 'them', 'get', 'use', 'using', 'used', 'work'
]);

async function loadCourseData() {
    try {
        const response = await fetch('courseData.json');
        courseData = await response.json();
        console.log('Course data loaded successfully');
    } catch (error) {
        console.error('Error loading course data:', error);
        showError('Failed to load course data. Please refresh the page.');
    }
}

function normalizeText(text) {
    return text
        .toLowerCase()
        .replace(/[^\w\s-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function tokenize(text) {
    const normalized = normalizeText(text);
    const tokens = normalized.split(' ').filter(token =>
        token.length > 2 && !stopWords.has(token)
    );
    return tokens;
}

function calculateMatchScore(queryTokens, moduleKeywords) {
    let score = 0;
    const matchedKeywords = [];

    const normalizedKeywords = moduleKeywords.map(k => normalizeText(k));

    queryTokens.forEach(token => {
        normalizedKeywords.forEach((keyword, index) => {
            if (keyword.includes(token) || token.includes(keyword)) {
                score += 1;
                if (!matchedKeywords.includes(moduleKeywords[index])) {
                    matchedKeywords.push(moduleKeywords[index]);
                }
            }
        });
    });

    const exactMatches = queryTokens.filter(token =>
        normalizedKeywords.includes(token)
    );
    score += exactMatches.length * 2;

    return { score, matchedKeywords };
}

function findBestMatch(question) {
    if (!courseData || !courseData.modules) {
        return null;
    }

    const queryTokens = tokenize(question);

    if (queryTokens.length === 0) {
        return null;
    }

    let bestMatch = null;
    let highestScore = 0;
    let bestMatchedKeywords = [];

    courseData.modules.forEach(module => {
        const { score, matchedKeywords } = calculateMatchScore(queryTokens, module.keywords);

        if (score > highestScore) {
            highestScore = score;
            bestMatch = module;
            bestMatchedKeywords = matchedKeywords;
        }
    });

    const threshold = 1;

    if (highestScore < threshold) {
        return null;
    }

    const maxPossibleScore = queryTokens.length * 3;
    const confidence = Math.min(Math.round((highestScore / maxPossibleScore) * 100), 100);

    return {
        module: bestMatch,
        confidence: confidence,
        matchedKeywords: bestMatchedKeywords
    };
}

function displayAnswer(result) {
    const answerSection = document.getElementById('answerSection');
    const moduleTitle = document.getElementById('moduleTitle');
    const confidenceScore = document.getElementById('confidenceScore');
    const explanation = document.getElementById('explanation');
    const example = document.getElementById('example');
    const matchedKeywords = document.getElementById('matchedKeywords');

    moduleTitle.textContent = result.module.title;
    confidenceScore.textContent = `${result.confidence}%`;
    explanation.textContent = result.module.explanation;
    example.textContent = result.module.example;

    matchedKeywords.innerHTML = '';
    result.matchedKeywords.forEach(keyword => {
        const tag = document.createElement('span');
        tag.className = 'keyword-tag';
        tag.textContent = keyword;
        matchedKeywords.appendChild(tag);
    });

    if (result.matchedKeywords.length === 0) {
        const tag = document.createElement('span');
        tag.className = 'keyword-tag';
        tag.textContent = 'General match';
        matchedKeywords.appendChild(tag);
    }

    answerSection.classList.remove('hidden');
    answerSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function showError(message) {
    const errorElement = document.getElementById('errorMessage');
    errorElement.textContent = message;
    setTimeout(() => {
        errorElement.textContent = '';
    }, 5000);
}

function saveToHistory(question, result) {
    const historyItem = {
        question: question,
        moduleTitle: result ? result.module.title : 'No match found',
        confidence: result ? result.confidence : 0,
        timestamp: new Date().toISOString()
    };

    questionHistory.unshift(historyItem);

    if (questionHistory.length > 10) {
        questionHistory = questionHistory.slice(0, 10);
    }

    localStorage.setItem('questionHistory', JSON.stringify(questionHistory));
    displayHistory();
}

function loadHistory() {
    const saved = localStorage.getItem('questionHistory');
    if (saved) {
        try {
            questionHistory = JSON.parse(saved);
            displayHistory();
        } catch (error) {
            console.error('Error loading history:', error);
            questionHistory = [];
        }
    }
}

function displayHistory() {
    const historyList = document.getElementById('historyList');

    if (questionHistory.length === 0) {
        historyList.innerHTML = '<p class="no-history">No questions asked yet</p>';
        return;
    }

    historyList.innerHTML = '';

    questionHistory.forEach((item, index) => {
        const historyItem = document.createElement('div');
        historyItem.className = 'history-item';

        const question = document.createElement('div');
        question.className = 'history-question';
        question.textContent = item.question;

        const meta = document.createElement('div');
        meta.className = 'history-meta';

        const module = document.createElement('span');
        module.className = 'history-module';
        module.textContent = item.moduleTitle;

        const confidence = document.createElement('span');
        confidence.className = 'history-confidence';
        confidence.textContent = `${item.confidence}% match`;

        const timestamp = document.createElement('span');
        const date = new Date(item.timestamp);
        timestamp.textContent = date.toLocaleString();

        meta.appendChild(module);
        meta.appendChild(confidence);
        meta.appendChild(timestamp);

        historyItem.appendChild(question);
        historyItem.appendChild(meta);

        historyItem.addEventListener('click', () => {
            document.getElementById('questionInput').value = item.question;
            handleAskQuestion();
        });

        historyList.appendChild(historyItem);
    });
}

function clearHistory() {
    if (confirm('Are you sure you want to clear your question history?')) {
        questionHistory = [];
        localStorage.removeItem('questionHistory');
        displayHistory();
    }
}

function handleAskQuestion() {
    const questionInput = document.getElementById('questionInput');
    const question = questionInput.value.trim();

    if (!question) {
        showError('Please enter a question before asking.');
        return;
    }

    if (!courseData) {
        showError('Course data is still loading. Please try again in a moment.');
        return;
    }

    const result = findBestMatch(question);

    if (!result) {
        showError('No relevant content found. Please refine your question or try asking about JavaScript, CSS, arrays, functions, async programming, DOM, storage, or error handling.');
        document.getElementById('answerSection').classList.add('hidden');
        saveToHistory(question, null);
        return;
    }

    displayAnswer(result);
    saveToHistory(question, result);
    document.getElementById('errorMessage').textContent = '';
}

document.addEventListener('DOMContentLoaded', () => {
    loadCourseData();
    loadHistory();

    const askButton = document.getElementById('askButton');
    const questionInput = document.getElementById('questionInput');
    const clearHistoryBtn = document.getElementById('clearHistoryBtn');

    askButton.addEventListener('click', handleAskQuestion);

    questionInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleAskQuestion();
        }
    });

    clearHistoryBtn.addEventListener('click', clearHistory);
});
