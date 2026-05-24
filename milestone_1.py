import os
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from dotenv import load_dotenv
from langchain_core.prompts import ChatPromptTemplate
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.output_parsers import StrOutputParser

load_dotenv()

app = Flask(__name__)
CORS(app)  # Enable CORS for frontend-backend communication

# Initialize the model once
def get_llm():
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        raise ValueError("Google API Key is missing. Please check your .env file.")
    return ChatGoogleGenerativeAI(
        model="gemini-2.5-flash", 
        temperature=0.7, 
        google_api_key=api_key,
        convert_system_message_to_human=True  # <--- Add this line
    )
    return ChatGoogleGenerativeAI(model="gemini-2.5-flash", temperature=0.3, google_api_key=api_key)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy", "message": "API is running"}), 200

@app.route('/generate_recipe', methods=['POST'])
def generate_recipe():
    try:
        data = request.json
        dish_name = data.get('dish_name', '').strip()
        diet = data.get('diet', 'Any').strip() or 'Any'
        ingredients = data.get('ingredients', '').strip()

        # Validation: Require either dish name OR ingredients
        if not ingredients and not dish_name:
            return jsonify({"error": "Please provide either a specific dish name or a list of ingredients."}), 400

        model = get_llm()
        
        # Dynamically build the user prompt based on what they filled out
        if dish_name:
            user_prompt = f"Provide a complete, gourmet recipe for {dish_name}."
            if diet.lower() != 'any':
                user_prompt += f" It MUST adhere strictly to a {diet} diet."
            if ingredients:
                user_prompt += f" Incorporate as many of these available ingredients as make culinary sense: {ingredients}."
        else:
            user_prompt = f"Create a unique, gourmet dish for someone whose diet is {diet} and wants to use these ingredients: {ingredients}"

        prompt_template = ChatPromptTemplate.from_messages([
            ("system", """You are a helpful Creative Michelin-Star chef specializing in Hyderabadi and gourmet cuisine. 
            Provide a complete recipe in Markdown format. You MUST include these exact headings:
            ## Recipe Title
            ### Summary
            ### Cooking Time & Servings
            ### Ingredients
            ### Step-by-Step Instructions"""),
            ("user", "{user_prompt}")
        ])
        
        chef_chain = prompt_template | model | StrOutputParser()
        response = chef_chain.invoke({"user_prompt": user_prompt})
        
        return jsonify({"recipe": response})

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/ask_followup', methods=['POST'])
def ask_followup():
    try:
        data = request.json
        question = data.get('question')
        recipe_context = data.get('recipe_context', '')

        if not question:
            return jsonify({"error": "Question is required."}), 400

        model = get_llm()
        
        prompt_template = ChatPromptTemplate.from_messages([
            ("system", "You are a helpful culinary assistant. A user is asking a follow-up question about a recipe you generated. Keep your answers concise, practical, and in Markdown."),
            ("user", "Recipe Context:\n{context}\n\nUser Question: {question}")
        ])
        
        chain = prompt_template | model | StrOutputParser()
        response = chain.invoke({"context": recipe_context, "question": question})
        
        return jsonify({"answer": response})

    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)