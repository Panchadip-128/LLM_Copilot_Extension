# LLM Copilot Extension for VS Code

A comprehensive **Visual Studio Code extension** designed to enhance your development workflow by integrating multiple **state-of-the-art Large Language Models (LLMs)** directly into the editor. This extension provides code generation, intelligent suggestions, problem-solving assistance, and even **workflow visualization**—helping developers save time, boost productivity, and understand code structurally.
 
 Active GROQ API Key (FREE VERSION) supports : Gemini 1.5 Flash , Llama 3.1 (8B, 405B), Gemma 2 (9B). Paid APIs can be used to access more advanced models.
---

## Table of Contents
- [Introduction](#introduction)
- [Key Features](#key-features)
- [Demos](#demos)
- [Prerequisites](#prerequisites)
- [Installation and Setup](#installation-and-setup)
- [Configuration](#configuration)
- [Usage](#usage)
- [Technical Overview](#technical-overview)
- [Code Snippets](#code-snippets)
- [Repository](#repository)

---

## Introduction
The **LLM Copilot Extension for VS Code** was developed to enhance coding efficiency by seamlessly integrating **advanced AI models** like **Llama 3.1, OpenAI GPT-3.5-Turbo, and Google Gemini 1.5**. These models enable:
- Context-aware code generation
- Autocompletion and bug fixing
- LeetCode/DSA problem-solving
- Workflow diagram generation from functions
-  **Code Analysis Features**:
  - -Right-click menu integration
  - -Detailed pattern analysis reports
  - -Performance metrics report
  - -Actionable improvement suggestions

This extension uses a **modular provider architecture**, making it easy to plug in new providers and scale capabilities as newer LLMs emerge.

---

## Key Features

### Multi-Provider & Multi-Model Support
Switch between AI providers and their flagship models directly within the chat interface:

| Provider   | Supported Models                             |
|------------|----------------------------------------------|
| **Groq**   | Llama 3.1 (8B, 405B), Gemma 2 (9B)           |
| **Google** | Gemini 1.5 Pro, Gemini 1.5 Flash             |
| **OpenAI** | GPT-4o, GPT-3.5-Turbo                        |

### Interactive Chat Interface
- Intuitive Webview panel for querying LLMs.
- Handles everything from **small snippets** to **complex architecture discussions**.

### Code-to-Workflow Visualization
- Automatically generate **Mermaid.js flowcharts** from selected functions.
- Helps document, visualize, and debug complex logic.

### Code Generation & Autocompletion
- Generate context-aware snippets.
- Solve **LeetCode & DSA** problems.
- Assist with debugging and unit test generation.

### User-Friendly UI
- Built with HTML, CSS, and JS.
- Dropdown for model selection.
- AI responses displayed in **formatted code blocks**.

### Workflow Diagram Generation
To visualize your code flow:
1. Select the code you want to visualize
2. Right-click and select "AI: Generate Workflow Diagram"
3. View the generated Mermaid.js flowchart showing:
   - Control flow
   - Conditional branches
   - Loop structures
   - Error handling paths

### Code Pattern Detection
To analyze patterns in your code:
1. Select the code you want to analyze
2. Right-click and select "AI: Detect Code Patterns"
3. View the comprehensive analysis including:
   - Design patterns identified with confidence levels
   - Anti-patterns and code smells
   - Performance metrics and bottlenecks
   - Actionable recommendations

---

## Demos
- **Interactive Chat with Provider Selection**  
  *<img width="1918" height="1077" alt="image" src="https://github.com/user-attachments/assets/eec984c0-c6b2-4375-9144-527301bc7f40" />

*
* <img width="1919" height="1079" alt="image" src="https://github.com/user-attachments/assets/257d3381-b1a8-42d8-9649-5a287811e67b" />
 *


- **Workflow Diagram Generation**  
  *<img width="1919" height="1079" alt="image" src="https://github.com/user-attachments/assets/ce79d81d-0b53-46e4-9714-232da077a1b9" />
*
  
---

## Prerequisites
Ensure the following are installed:
- **Visual Studio Code** (v1.92.0 or higher)
- **Node.js** (v18.x or higher)
- **TypeScript** (for compiling)
- API Keys from supported providers: **Groq, OpenAI, Google, Together.ai**

---

## Installation and Setup

### 1. Clone the repository
```bash
git clone https://github.com/Panchadip-128/LLM_Copilot_Extension
cd LLM_Copilot_Extension
```

### 2. Install dependencies
```bash
npm install
```

### 3. Compile TypeScript
```bash
npm run compile
```

### 4. Run the extension
```bash
code --extensionDevelopmentPath=PATH_TO_PROJECT
```
Or press **F5** inside VS Code.

---

## Configuration
Add your API keys to `settings.json`:
```json
{
    "codeAssistant.groq.apiKey": "YOUR_GROQ_API_KEY",
    "codeAssistant.gemini.apiKey": "YOUR_GEMINI_API_KEY",
    "codeAssistant.gpt.apiKey": "YOUR_OPENAI_API_KEY"
}
```

---

## Usage
- Launch the extension (**F5** in VS Code).
- Open Command Palette (**Ctrl+Shift+P**) → `Open AI Code Assistant`.
- Choose a provider, type queries, and interact in the chat panel.
- Right-click on any function → `Generate Workflow Diagram`.

---

## Technical Overview
<details>
<summary><b>Click to expand</b></summary>

- **package.json**
  - Metadata (name, version, engines)
  - Defines commands (e.g., `extension.openChat`)
  - Includes dependencies like **axios** for API calls

- **extension.ts**
  - Registers commands
  - Creates and manages Webview panel
  - Orchestrates communication between **UI ↔ Backend ↔ API Providers**

- **API Providers**
  - Modular classes: `GroqProvider`, `GeminiProvider`, `GPTProvider`
  - Encapsulate authentication, request formatting, response parsing

- **getCodeSnippet Function**
  - Sends POST requests with user query
  - Processes and formats AI responses
  - Returns code snippets or workflow diagrams

- **UI (Webview)**
  - Built with HTML, CSS, JS
  - Dropdown for provider/model selection
  - AI response shown in code block with copy support

</details>

---

## Code Snippets

### extension.ts (Activate Function) - Sample code to demonstrate our idea
```ts
export function activate(context: vscode.ExtensionContext) {
    let disposable = vscode.commands.registerCommand('extension.openChat', () => {
        const panel = vscode.window.createWebviewPanel(
            'aiAssistant',
            'AI Code Assistant',
            vscode.ViewColumn.One,
            { enableScripts: true }
        );
        panel.webview.html = getWebviewContent();
    });
    context.subscriptions.push(disposable);
}
```

### Making API Calls (getCodeSnippet) - Sample code to demonstrate our idea
```ts
async function getCodeSnippet(query: string, provider: string): Promise<string> {
    const response = await axios.post(`https://api.${provider}.com/v1/generate`, {
        prompt: query,
        max_tokens: 500
    }, {
        headers: { 'Authorization': `Bearer ${getApiKey(provider)}` }
    });
    return response.data.output || "No response received.";
}
```

### Sample Webview UI (HTML)
```html
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; }
    #response { background: #f4f4f4; padding: 10px; border-radius: 5px; }
  </style>
</head>
<body>
  <h2>AI Code Assistant</h2>
  <select id="modelSelector">
    <option value="gpt">OpenAI GPT</option>
    <option value="gemini">Gemini</option>
    <option value="llama">Llama</option>
  </select>
  <textarea id="query" placeholder="Type your question here..."></textarea>
  <button onclick="sendQuery()">Ask</button>
  <pre id="response"></pre>
</body>
</html>
```

---

## Repository
Access the complete source code here:  
👉 [LLM Copilot Extension on GitHub](https://github.com/Panchadip-128/LLM_Copilot_Extension)


Sample chat and prompt response demonstration:
-----------------------------------------
![sample_chat_interface](https://github.com/user-attachments/assets/43cab310-e93e-4040-bc4c-4390c99684f6)

Personalized chat interface to match your needs :
-----------------------------------------
![Personalized_response](https://github.com/user-attachments/assets/30071652-86ed-4eae-9da3-a59df866635c)

Upadted Version: <img width="1493" height="926" alt="image" src="https://github.com/user-attachments/assets/9be09fba-728d-4405-ab4a-924f81ca0df8" />
# MERMAID INTEGRATION : TO INSTANTLY UPDATE WORKFLOW DIAGRAM FOR ANY CODE
<img width="1919" height="1079" alt="image" src="https://github.com/user-attachments/assets/d496fcba-0ebc-412a-80eb-23b68c4daa32" />

<img width="1919" height="1079" alt="image" src="https://github.com/user-attachments/assets/2de44e0c-7bc8-4f7f-be0b-7c7cb6d0cf60" />

<img width="1913" height="1077" alt="image" src="https://github.com/user-attachments/assets/a2c54b1b-84c8-4166-bccd-eb4c972e8a1c" />

<img width="1919" height="1078" alt="image" src="https://github.com/user-attachments/assets/4f08e7a7-a5a2-4658-bcbc-98cdc3fbec93" />

<img width="1919" height="1079" alt="image" src="https://github.com/user-attachments/assets/ce79d81d-0b53-46e4-9714-232da077a1b9" />

Likewise code analysis id segmented into multiple parameters as follows in sidewise copilot window:

<img width="728" height="956" alt="image" src="https://github.com/user-attachments/assets/dbf29c66-b124-4d40-ba8b-15dd45d3d3e1" />
<img width="1919" height="1079" alt="image" src="https://github.com/user-attachments/assets/98283528-3f5a-42b9-a5d8-84496dc9c0c0" />
<img width="1919" height="1079" alt="image" src="https://github.com/user-attachments/assets/54262a4d-8201-466b-ad88-9e08a9dd0907" />






