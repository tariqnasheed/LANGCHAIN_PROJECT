let currentRecipeRaw = "";

document.addEventListener('DOMContentLoaded', () => {
    loadHistory();
});

async function generateRecipe() {
    const dish_name = document.getElementById('dish_name').value; // NEW
    const diet = document.getElementById('diet').value;
    const ingredients = document.getElementById('ingredients').value;
    const errorDiv = document.getElementById('error-message');
    const loadingDiv = document.getElementById('loading');
    const outputSection = document.getElementById('recipe-output-section');
    const btn = document.getElementById('generate-btn');

    // NEW VALIDATION: Check if at least one main field is filled
    if (!ingredients.trim() && !dish_name.trim()) {
        showError("Please provide either a specific dish name or a list of ingredients!");
        return;
    }

    // Reset UI
    errorDiv.classList.add('hidden');
    outputSection.classList.add('hidden');
    loadingDiv.classList.remove('hidden');
    btn.disabled = true;

    try {
        const response = await fetch('/generate_recipe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // NEW: Add dish_name to the payload
            body: JSON.stringify({ dish_name, diet, ingredients })
        });

        const data = await response.json();

        if (response.ok) {
            currentRecipeRaw = data.recipe;
            document.getElementById('recipe-content').innerHTML = marked.parse(data.recipe);
            outputSection.classList.remove('hidden');
            
            const titleMatch = data.recipe.match(/## (.*)/);
            const title = titleMatch ? titleMatch[1] : (dish_name || "Generated Recipe");
            saveToHistory(title, data.recipe);
            
            document.getElementById('chat-history').innerHTML = '';
        } else {
            showError(data.error || "Failed to generate recipe.");
        }
    } catch (error) {
        showError("Server error. Ensure the Flask backend is running.");
    } finally {
        loadingDiv.classList.add('hidden');
        btn.disabled = false;
    }
}

async function askFollowup() {
    const inputField = document.getElementById('followup-question');
    const question = inputField.value.trim();
    if (!question) return;

    const chatHistory = document.getElementById('chat-history');
    
    // Add user question to UI
    chatHistory.innerHTML += `<div class="chat-msg user"><strong>You:</strong> ${question}</div>`;
    inputField.value = '';

    // Add loading indicator
    const loadId = 'load-' + Date.now();
    chatHistory.innerHTML += `<div id="${loadId}" class="chat-msg chef"><i class="fas fa-spinner fa-spin"></i> Chef is thinking...</div>`;
    chatHistory.scrollTop = chatHistory.scrollHeight;

    try {
        const response = await fetch('/ask_followup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question: question, recipe_context: currentRecipeRaw })
        });

        const data = await response.json();
        document.getElementById(loadId).remove();

        if (response.ok) {
            chatHistory.innerHTML += `<div class="chat-msg chef"><strong>Chef:</strong><br>${marked.parse(data.answer)}</div>`;
        } else {
            chatHistory.innerHTML += `<div class="chat-msg chef" style="color:red;">Error: ${data.error}</div>`;
        }
    } catch (error) {
        document.getElementById(loadId).remove();
        chatHistory.innerHTML += `<div class="chat-msg chef" style="color:red;">Network Error.</div>`;
    }
    chatHistory.scrollTop = chatHistory.scrollHeight;
}

function showError(msg) {
    const errorDiv = document.getElementById('error-message');
    errorDiv.textContent = msg;
    errorDiv.classList.remove('hidden');
}

// --- Utility & Bonus Features ---

function copyRecipe() {
    navigator.clipboard.writeText(currentRecipeRaw).then(() => {
        alert("Recipe copied to clipboard!");
    });
}

function printRecipe() {
    window.print();
}

function shareRecipe() {
    if (navigator.share) {
        navigator.share({
            title: 'My Hyderabadi Recipe',
            text: currentRecipeRaw
        }).catch(console.error);
    } else {
        alert("Web Share API not supported on this browser. Use the Copy button instead.");
    }
}

// LocalStorage History functionality
function saveToHistory(title, recipeContent) {
    let history = JSON.parse(localStorage.getItem('recipeHistory') || '[]');
    // Add to beginning, keep only last 5
    history.unshift({ title, content: recipeContent, date: new Date().toLocaleDateString() });
    if (history.length > 5) history.pop();
    
    localStorage.setItem('recipeHistory', JSON.stringify(history));
    loadHistory();
}

function loadHistory() {
    const historyList = document.getElementById('history-list');
    const history = JSON.parse(localStorage.getItem('recipeHistory') || '[]');
    
    historyList.innerHTML = '';
    if (history.length === 0) {
        historyList.innerHTML = '<li>No recent recipes</li>';
        return;
    }

    history.forEach((item, index) => {
        const li = document.createElement('li');
        li.textContent = `${item.title} (${item.date})`;
        li.onclick = () => loadOldRecipe(index);
        historyList.appendChild(li);
    });
}

function loadOldRecipe(index) {
    const history = JSON.parse(localStorage.getItem('recipeHistory') || '[]');
    const recipe = history[index];
    if (recipe) {
        currentRecipeRaw = recipe.content;
        document.getElementById('recipe-content').innerHTML = marked.parse(recipe.content);
        document.getElementById('recipe-output-section').classList.remove('hidden');
        document.getElementById('chat-history').innerHTML = '';
    }
}

function saveFavorite() {
    const btn = document.getElementById('fav-btn');
    btn.innerHTML = '<i class="fas fa-heart"></i> Favorited!';
    btn.style.color = 'var(--saffron)';
    // In a full app, this would save to a separate favorites array in localStorage
}