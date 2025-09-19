import * as vscode from 'vscode';
import axios, { AxiosResponse, isAxiosError } from 'axios';
import { GoogleGenerativeAI } from '@google/generative-ai';

// The interface remains the same
interface LLMProvider {
    generateResponse(prompt: string, model?: string): Promise<string>;
}

//## Groq Provider (with updated model list)
class GroqProvider implements LLMProvider {
    private getApiKey(): string | undefined {
        return vscode.workspace.getConfiguration('codeAssistant.groq').get('apiKey');
    }

    async generateResponse(prompt: string, model: string = 'llama-3.1-8b-instant'): Promise<string> {
        const apiKey = this.getApiKey();
        if (!apiKey) {
            return 'Error: Groq API Key is not set.';
        }

        try {
            const response: AxiosResponse<any> = await axios.post(
                'https://api.groq.com/openai/v1/chat/completions',
                { model, messages: [{ role: 'user', content: prompt }] },
                { headers: { 'Authorization': `Bearer ${apiKey}` } }
            );
            return response.data.choices[0]?.message?.content?.trim() || 'No response generated';
        } catch (error) {
            if (isAxiosError(error)) {
                return `Groq API Error: ${error.response?.data?.error?.message || error.message}`;
            }
            return 'An unknown error occurred with Groq.';
        }
    }
}

//## Gemini Provider (re-introduced and updated)
class GeminiProvider implements LLMProvider {
    private getApiKey(): string | undefined {
        return vscode.workspace.getConfiguration('codeAssistant.gemini').get('apiKey');
    }

    // UPDATED: Changed the default model to the stable 1.5 Pro identifier
    async generateResponse(prompt: string, model: string = 'gemini-1.5-pro'): Promise<string> {
        const apiKey = this.getApiKey();
        if (!apiKey) {
            return 'Error: Gemini API Key is not set.';
        }

        try {
            const genAI = new GoogleGenerativeAI(apiKey);
            const geminiModel = genAI.getGenerativeModel({ model });
            const result = await geminiModel.generateContent(prompt);
            return (await result.response).text();
        } catch (error) {
            return `Gemini API Error: ${(error as Error).message}`;
        }
    }
}

//## Factory to select the correct provider
class LLMFactory {
    static getProvider(type: string): LLMProvider {
        switch (type.toLowerCase()) {
            case 'groq':
                return new GroqProvider();
            case 'gemini':
                return new GeminiProvider();
            default:
                // Default to Groq if something goes wrong
                return new GroqProvider();
        }
    }
}

//## Activate Function (with updated message handling)
export function activate(context: vscode.ExtensionContext) {
    let panel: vscode.WebviewPanel | undefined = undefined;

    const disposable = vscode.commands.registerCommand('codesuggestion.getCode', () => {
        if (panel) {
            panel.reveal(vscode.ViewColumn.Two);
            return;
        }

        panel = vscode.window.createWebviewPanel(
            'codeChat', 'AI Code Assistant', vscode.ViewColumn.Two,
            { enableScripts: true, retainContextWhenHidden: true }
        );

        panel.webview.html = getWebviewContent();

        panel.onDidDispose(() => { panel = undefined; }, null, context.subscriptions);

        // UPDATED: Handle messages with both provider and model info
        panel.webview.onDidReceiveMessage(
            async message => {
                if (message.command === 'sendMessage') {
                    const { prompt, provider, model } = message;
                    const llmProvider = LLMFactory.getProvider(provider);
                    const response = await llmProvider.generateResponse(prompt, model);

                    panel?.webview.postMessage({
                        command: 'receiveMessage',
                        text: response || "Sorry, I couldn't get a response."
                    });
                }
            },
            undefined,
            context.subscriptions
        );
    });

    context.subscriptions.push(disposable);
}


//## Webview Content (with two dropdowns)
function getWebviewContent(): string {
    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Code Assistant</title>
            <style>
                /* General Reset */
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }

                body {
                    font-family: 'Inter', sans-serif;
                    color: #f5f5f5;
                    background-color: #121212;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 100vh;
                    overflow: hidden;
                }

                #chat-container {
                    display: flex;
                    flex-direction: column;
                    width: 90%;
                    max-width: 800px;
                    height: 90%;
                    background: linear-gradient(145deg, #1e1e1e, #252525);
                    border-radius: 12px;
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3), 0 1px 3px rgba(0, 0, 0, 0.2);
                    overflow: hidden;
                }

                #messages {
                    flex-grow: 1;
                    overflow-y: auto;
                    padding: 20px;
                    background: #1a1a1a;
                    border-bottom: 1px solid #333;
                }

                .message {
                    margin-bottom: 15px;
                    padding: 15px;
                    border-radius: 8px;
                    line-height: 1.5;
                    font-size: 0.95rem;
                    word-wrap: break-word;
                }

                .user-message {
                    background-color: #0d47a1;
                    color: #fff;
                    text-align: right;
                    align-self: flex-end;
                }

                .ai-message {
                    background-color: #2e7d32;
                    color: #fff;
                    text-align: left;
                    align-self: flex-start;
                }

                #controls {
                    display: flex;
                    gap: 15px;
                    padding: 15px;
                    background: #1e1e1e;
                    border-top: 1px solid #333;
                    align-items: center;
                }

                select {
                    padding: 10px;
                    border-radius: 6px;
                    background-color: #2c2c2c;
                    color: #f5f5f5;
                    border: 1px solid #444;
                    font-size: 0.95rem;
                    outline: none;
                    transition: all 0.3s ease;
                }

                select:hover {
                    border-color: #666;
                }

                #input-container {
                    display: flex;
                    padding: 15px;
                    background: #1e1e1e;
                    border-top: 1px solid #333;
                }

                #prompt-input {
                    flex-grow: 1;
                    padding: 12px;
                    border-radius: 6px;
                    background-color: #2c2c2c;
                    color: #f5f5f5;
                    border: 1px solid #444;
                    font-size: 1rem;
                    outline: none;
                    transition: all 0.3s ease;
                }

                #prompt-input:focus {
                    border-color: #666;
                }

                button {
                    padding: 12px 20px;
                    border-radius: 6px;
                    background-color: #0d47a1;
                    color: #fff;
                    border: none;
                    font-size: 1rem;
                    cursor: pointer;
                    transition: all 0.3s ease;
                }

                button:hover {
                    background-color: #1565c0;
                }

                button:active {
                    transform: scale(0.98);
                }

                /* Scrollbar Styling */
                #messages::-webkit-scrollbar {
                    width: 8px;
                }

                #messages::-webkit-scrollbar-thumb {
                    background: #444;
                    border-radius: 4px;
                }

                #messages::-webkit-scrollbar-thumb:hover {
                    background: #555;
                }
            </style>
        </head>
        <body>
            <div id="chat-container">
                <div id="controls">
                    <span>Provider:</span>
                    <select id="provider-select">
                        <option value="groq">Groq</option>
                        <option value="gemini">Gemini</option>
                    </select>
                    <span>Model:</span>
                    <select id="model-select"></select>
                </div>
                <div id="messages">
                    <div class="ai-message">Hello! Select a provider and model, then ask me anything.</div>
                </div>
                <div id="input-container">
                    <input type="text" id="prompt-input" placeholder="Ask for code or programming help...">
                    <button id="send-button">Send</button>
                </div>
            </div>

            <script>
                const vscode = acquireVsCodeApi();
                const providerSelect = document.getElementById('provider-select');
                const modelSelect = document.getElementById('model-select');
                
                const models = {
                    groq: [
                        { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 (8B)' },
                        { id: 'llama-3.1-405b-reasoning', name: 'Llama 3.1 (405B)' },
                        { id: 'gemma2-9b-it', name: 'Gemma 2 (9B)' }
                    ],
                    gemini: [
                        { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
                        // UPDATED: Removed the '-latest' suffix
                        { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' }
                    ]
                };

                function updateModelOptions() {
                    const provider = providerSelect.value;
                    modelSelect.innerHTML = '';
                    models[provider].forEach(model => {
                        const option = document.createElement('option');
                        option.value = model.id;
                        option.textContent = model.name;
                        modelSelect.appendChild(option);
                    });
                }

                providerSelect.addEventListener('change', updateModelOptions);
                
                // Initial population
                updateModelOptions();

                const messagesDiv = document.getElementById('messages');
                const input = document.getElementById('prompt-input');
                const sendButton = document.getElementById('send-button');

                function addMessage(text, type) {
                    const el = document.createElement('div');
                    el.className = 'message ' + type;
                    el.textContent = text;
                    messagesDiv.appendChild(el);
                    messagesDiv.scrollTop = messagesDiv.scrollHeight;
                }

                function handleSend() {
                    const text = input.value;
                    if (text) {
                        addMessage(text, 'user-message');
                        vscode.postMessage({ 
                            command: 'sendMessage', 
                            prompt: text,
                            provider: providerSelect.value,
                            model: modelSelect.value
                        });
                        input.value = '';
                    }
                }

                sendButton.addEventListener('click', handleSend);
                input.addEventListener('keydown', e => { if (e.key === 'Enter') handleSend(); });

                window.addEventListener('message', event => {
                    if (event.data.command === 'receiveMessage') {
                        addMessage(event.data.text, 'ai-message');
                    }
                });
            </script>
        </body>
        </html>
    `;
}

export function deactivate() {}
