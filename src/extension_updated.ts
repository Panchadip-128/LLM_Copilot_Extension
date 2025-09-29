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

    // NEW: Command to generate workflow diagram
    context.subscriptions.push(
        vscode.commands.registerCommand('codesuggestion.generateWorkflowDiagram', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('No active editor found. Please select some code to generate a workflow diagram.');
                return;
            }

            const selection = editor.selection;
            const selectedText = editor.document.getText(selection);

            if (!selectedText) {
                vscode.window.showErrorMessage('No code selected. Please select some code to generate a workflow diagram.');
                return;
            }

            const providerType = vscode.workspace.getConfiguration('codeAssistant').get<string>('activeModel', 'groq');
            const provider = LLMFactory.getProvider(providerType);

            try {
                const prompt = `You are an expert code analysis tool. Your task is to convert a given code block into a Mermaid.js flowchart syntax.

CRITICAL INSTRUCTIONS:
1. Your response MUST start with 'graph TD' or 'graph LR'.
2. Your response MUST contain ONLY the valid Mermaid.js code.
3. Do NOT include ANY explanations, apologies, or markdown fences like \`\`\`mermaid.
4. Analyze the code for logical branches (if/else), loops, and error handling (try/except) to create the flowchart.

Here is the code to analyze:
\`\`\`
${selectedText}
\`\`\``;
                const mermaidSyntax = await provider.generateResponse(prompt);

                console.log("--- LLM Raw Output for Mermaid ---");
                console.log(mermaidSyntax);
                console.log("---------------------------------");

                // Ensure the webview panel is created and updated with the generated Mermaid.js syntax
                const panel = vscode.window.createWebviewPanel(
                    'workflowDiagram', // Identifier
                    'Workflow Diagram', // Title
                    vscode.ViewColumn.One, // Editor column to show the new webview panel
                    { enableScripts: true } // Options
                );

                const sanitizedResponse = mermaidSyntax
                    .replace(/```mermaid/g, '') // Remove markdown fences
                    .replace(/```/g, '') // Remove any remaining fences
                    .trim(); // Remove extra whitespace

                console.log("--- Sanitized Mermaid Output ---");
                console.log(sanitizedResponse);
                console.log("--------------------------------");

                // NEW: Validate the Mermaid.js syntax before rendering
                if (!sanitizedResponse.startsWith('graph TD') && !sanitizedResponse.startsWith('graph LR')) {
                    vscode.window.showErrorMessage('Invalid Mermaid.js syntax generated. Please try again.');
                    return;
                }

                panel.webview.html = getWebviewContentWithMermaid(sanitizedResponse);
            } catch (error) {
                vscode.window.showErrorMessage(`Error generating workflow diagram: ${(error as Error).message}`);
            }
        })
    );

    // Add this in your activate function, with the other command registrations
    context.subscriptions.push(
        vscode.commands.registerCommand('codesuggestion.detectPatterns', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('No active editor found.');
                return;
            }

            const selection = editor.selection;
            const code = editor.document.getText(selection);
            if (!code) {
                vscode.window.showErrorMessage('No code selected.');
                return;
            }

            try {
                // Show loading message
                vscode.window.showInformationMessage('Analyzing code patterns...');
                
                const provider = LLMFactory.getProvider(
                    vscode.workspace.getConfiguration('codeAssistant')
                        .get<string>('activeModel', 'groq')
                );

                const analysisResult = await analyzeCodePatterns(code, provider);
                console.log('Analysis Result:', analysisResult); // Debug log
                
                const panel = vscode.window.createWebviewPanel(
                    'patternDetector',
                    'Code Pattern Analysis',
                    vscode.ViewColumn.Two,
                    { enableScripts: true }
                );

                panel.webview.html = getPatternAnalysisWebviewContent(analysisResult);
            } catch (error) {
                console.error('Pattern Detection Error:', error); // Debug log
                vscode.window.showErrorMessage(
                    `Error analyzing patterns: ${(error as Error).message}`
                );
            }
        })
    );
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

// NEW: Function to generate webview content with Mermaid.js for rendering the workflow diagram
function getWebviewContentWithMermaid(mermaidSyntax: string): string {
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Workflow Diagram</title>
        <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
        <script>mermaid.initialize({ startOnLoad: true });</script>
    </head>
    <body>
        <h1>Generated Workflow Diagram</h1>
        <div class="mermaid">
            ${mermaidSyntax}
        </div>
    </body>
    </html>`;
}

// Add these interfaces at the top of your file
interface CodePattern {
    name: string;
    description: string;
    location: string;
    confidence: number;
    impact: string;
}

interface CodeAntiPattern {
    issue: string;
    impact: string;
    solution: string;
    severity: 'low' | 'medium' | 'high';
}

interface CodeRecommendation {
    title: string;
    details: string;
    example: string;
    complexity: string;
    performance_impact: string;
}

interface PatternAnalysis {
    patterns: CodePattern[];
    antiPatterns: CodeAntiPattern[];
    recommendations: CodeRecommendation[];
    performance_metrics: {
        time_complexity: string;
        space_complexity: string;
        potential_bottlenecks: string[];
    };
}

// Add this function to your file
async function analyzeCodePatterns(code: string, provider: LLMProvider): Promise<string> {
    const prompt = `You are an expert code analyzer. Analyze the following code comprehensively and return your analysis in STRICT JSON format.

    CRITICAL RESPONSE REQUIREMENTS:
    1. Response MUST be PURE JSON - no markdown, no code blocks, no backticks
    2. Every string MUST be properly quoted
    3. Numbers must be actual numbers (not strings)
    4. Arrays must be properly formatted with square brackets
    5. "severity" values MUST be exactly "high", "medium", or "low"
    6. "confidence" values MUST be numbers between 0 and 1
    7. DO NOT include any explanation text outside the JSON
    8. DO NOT use any markdown formatting characters
    9. Ensure all property names exactly match the schema below

    EXACT JSON SCHEMA TO FOLLOW:
    {
        "patterns": [
            {
                "name": "string - name of the pattern",
                "description": "string - detailed explanation of the pattern",
                "location": "string - specific class/method/line where pattern is used",
                "confidence": 0.95,
                "impact": "string - specific impact on code quality"
            }
        ],
        "antiPatterns": [
            {
                "issue": "string - name and description of the anti-pattern",
                "impact": "string - specific negative effects",
                "solution": "string - concrete steps to fix",
                "severity": "string - exactly one of: high, medium, low"
            }
        ],
        "recommendations": [
            {
                "title": "string - short action title",
                "details": "string - detailed explanation",
                "example": "string - code example (NO markdown)",
                "complexity": "string - exactly one of: high, medium, low",
                "performance_impact": "string - exactly one of: high, medium, low"
            }
        ],
        "performance_metrics": {
            "time_complexity": "string - Big O notation",
            "space_complexity": "string - Big O notation",
            "potential_bottlenecks": [
                "string - specific method or operation that could be a bottleneck"
            ]
        }
    }

    CODE TO ANALYZE:
    ${code}`;

    const response = await provider.generateResponse(prompt);
    
    // Clean up the response to ensure valid JSON
    const cleanedResponse = response
        .replace(/```json\s*/g, '') // Remove ```json
        .replace(/```\s*/g, '')     // Remove remaining ```
        .trim();                    // Remove whitespace
        
    // Validate JSON structure
    try {
        JSON.parse(cleanedResponse);
        return cleanedResponse;
    } catch (error) {
        throw new Error(`Invalid JSON response from LLM: ${(error as Error).message}`);
    }
}

// Add this function to render the analysis
function getPatternAnalysisWebviewContent(analysisResult: string): string {
    try {
        // Pre-process and clean the analysisResult if needed
        const cleanedResult = analysisResult.trim();
        
        // Attempt to parse the JSON
        const analysis: PatternAnalysis = JSON.parse(cleanedResult);
        
        // Validate the required properties
        if (!analysis.patterns || !analysis.antiPatterns || !analysis.recommendations || !analysis.performance_metrics) {
            throw new Error('Missing required properties in analysis result');
        }
        
        return `<!DOCTYPE html>
        <html>
        <head>
            <style>
                body { 
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; 
                    padding: 20px;
                    line-height: 1.5;
                    color: #e0e0e0;
                    background-color: #1e1e1e;
                }
                .section { 
                    margin-bottom: 30px;
                    background: #2d2d2d;
                    border-radius: 8px;
                    padding: 20px;
                }
                .pattern { 
                    background: #1e3a8a;
                    padding: 15px;
                    margin: 10px 0;
                    border-radius: 6px;
                }
                .antipattern { 
                    background: #7f1d1d;
                    padding: 15px;
                    margin: 10px 0;
                    border-radius: 6px;
                }
                .recommendation { 
                    background: #064e3b;
                    padding: 15px;
                    margin: 10px 0;
                    border-radius: 6px;
                }
                .confidence-bar {
                    height: 4px;
                    background: #4f46e5;
                    margin-top: 8px;
                }
                .severity-high { border-left: 4px solid #ef4444; }
                .severity-medium { border-left: 4px solid #f59e0b; }
                .severity-low { border-left: 4px solid #10b981; }
                code {
                    display: block;
                    background: #1a1a1a;
                    padding: 10px;
                    margin: 10px 0;
                    border-radius: 4px;
                    font-family: 'Consolas', 'Courier New', monospace;
                }
                .metrics {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 15px;
                    margin-top: 15px;
                }
                .metric-card {
                    background: #374151;
                    padding: 15px;
                    border-radius: 6px;
                }
            </style>
        </head>
        <body>
            <h1>Code Pattern Analysis</h1>
            
            <div class="section">
                <h2>Design Patterns Found</h2>
                ${analysis.patterns.map(p => `
                    <div class="pattern">
                        <h3>${p.name}</h3>
                        <p>${p.description}</p>
                        <p><em>Location: ${p.location}</em></p>
                        <p>Impact: ${p.impact}</p>
                        <div class="confidence-bar" style="width: ${p.confidence * 100}%"></div>
                    </div>
                `).join('')}
            </div>

            <div class="section">
                <h2>Anti-Patterns Detected</h2>
                ${analysis.antiPatterns.map(a => `
                    <div class="antipattern severity-${a.severity}">
                        <h3>${a.issue}</h3>
                        <p><strong>Impact:</strong> ${a.impact}</p>
                        <p><strong>Solution:</strong> ${a.solution}</p>
                        <p><strong>Severity:</strong> ${a.severity}</p>
                    </div>
                `).join('')}
            </div>

            <div class="section">
                <h2>Performance Analysis</h2>
                <div class="metrics">
                    <div class="metric-card">
                        <h3>Time Complexity</h3>
                        <p>${analysis.performance_metrics.time_complexity}</p>
                    </div>
                    <div class="metric-card">
                        <h3>Space Complexity</h3>
                        <p>${analysis.performance_metrics.space_complexity}</p>
                    </div>
                </div>
                <div class="metric-card" style="margin-top: 15px;">
                    <h3>Potential Bottlenecks</h3>
                    <ul>
                        ${analysis.performance_metrics.potential_bottlenecks.map(b => `
                            <li>${b}</li>
                        `).join('')}
                    </ul>
                </div>
            </div>

            <div class="section">
                <h2>Recommendations</h2>
                ${analysis.recommendations.map(r => `
                    <div class="recommendation">
                        <h3>${r.title}</h3>
                        <p>${r.details}</p>
                        <code>${r.example}</code>
                        <p><strong>Implementation Complexity:</strong> ${r.complexity}</p>
                        <p><strong>Performance Impact:</strong> ${r.performance_impact}</p>
                    </div>
                `).join('')}
            </div>
        </body>
        </html>`;
    } catch (error) {
        console.error('Error parsing analysis:', error); // Debug log
        console.error('Error details:', error);
        return `<html><body style="color: #e0e0e0; background-color: #1e1e1e; padding: 20px;">
            <h1>Error Analyzing Code</h1>
            <p>Error parsing analysis result: ${(error as Error).message}</p>
            <details>
                <summary style="color: #f87171; cursor: pointer; margin: 10px 0;">Show Raw Response</summary>
                <pre style="background: #1a1a1a; padding: 15px; border-radius: 4px; overflow-x: auto;">${
                    analysisResult.replace(/</g, '&lt;').replace(/>/g, '&gt;')
                }</pre>
            </details>
            <p style="margin-top: 20px; color: #9ca3af;">
                If this error persists, try selecting a smaller code section or checking if the selected code is valid.
            </p>
        </body></html>`;
    }
}

export function deactivate() {}
