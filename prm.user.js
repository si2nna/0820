// ==UserScript==
// @name         캐릭터 프롬프트 생성기 사이드바 (배포용)
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  커스텀 프롬프트 프리셋 지원
// @author       You
// @match        *://*/*
// @grant        GM_xmlhttpRequest
// @connect      generativelanguage.googleapis.com
// ==/UserScript==

(function() {
    'use strict';

    if (window.self !== window.top) return;
    const currentDomain = window.location.hostname;
    if (currentDomain.includes('chatgpt.com') || currentDomain.includes('google.com')) return;

    // 

    const DEFAULT_PRESETS = [
        {
            id: Date.now().toString(),
            name: "기본 템플릿",
            rules: `당신은 1:1 역할극(AI 채팅)을 위한 뛰어난 캐릭터 프롬프트 엔지니어입니다.
사용자가 제시하는 '캐릭터 러프 아이디어'를 바탕으로, 아래의 [작성 규칙]과 [레퍼런스 예시]의 형태를 완벽히 모방하여 캐릭터 프로필을 완성하세요.

[작성 규칙]
- 서술 방식: 구구절절한 자연어 문장보다는 명사형 종결 및 핵심 키워드 위주로 간결하게 압축할 것.
- 내용 보강: 사용자의 아이디어가 짧더라도, AI가 알아서 어울리는 세부 설정(성격, 외모, 특징, 말투 등)을 풍부하게 살을 붙여 창작할 것.
- 출력 규칙: 불필요한 인사말이나 서론은 절대 생략하고 프로필 내용만 즉시 출력할 것.`,
            reference: `# 캐릭터 프로필
- 이름: OOO
- 나이/성별: OO세 / O
- 외형: (헤어스타일, 체격, 옷차림 등)
- 직업: (구체적인 직업이나 소속)

# 성격 및 특징
- 성격: (성격 키워드 3~4개)
- 호불호: (좋아하는 것 / 싫어하는 것)
- 특징: (캐릭터를 입체적으로 만들어주는 독특한 습관이나 배경설정)

# 말투
- 말투: (존댓말/반말 여부, 억양 등)
`
        }
    ];

    let presets = JSON.parse(localStorage.getItem('cp_prompt_presets')) || DEFAULT_PRESETS;
    if (presets.length === 0) presets = [...DEFAULT_PRESETS];
    let currentPresetId = localStorage.getItem('cp_current_preset_id') || presets[0].id;

    // 

    const sidebar = document.createElement('div');
    sidebar.id = 'cp-prompt-sidebar';
    sidebar.style.cssText = `
        position: fixed;
        top: 0;
        right: -450px;
        width: 450px;
        height: 100vh;
        background-color: #1e1e1e;
        box-shadow: -2px 0 10px rgba(0,0,0,0.5);
        z-index: 9999998;
        transition: right 0.3s ease-in-out;
        font-family: 'Malgun Gothic', sans-serif;
        color: #e0e0e0;
        box-sizing: border-box;
    `;

    const toggleBtn = document.createElement('div');
    toggleBtn.innerText = '프롬프트\n생성기';
    toggleBtn.style.cssText = `
        position: absolute;
        top: 56.1%;
        left: -50px;
        width: 50px;
        height: 80px;
        background-color: #6f42c1;
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        text-align: center;
        font-size: 11px;
        font-weight: bold;
        cursor: pointer;
        border-radius: 8px 0 0 8px;
        box-shadow: -2px 0 5px rgba(0,0,0,0.3);
        transform: translateY(-50%);
        user-select: none;
        opacity: 0.5;
        transition: opacity 0.2s;
    `;

    toggleBtn.addEventListener('mouseenter', () => toggleBtn.style.opacity = '1');
    toggleBtn.addEventListener('mouseleave', () => toggleBtn.style.opacity = '0.5');

    const content = document.createElement('div');
    content.style.cssText = `
        padding: 15px;
        height: 100%;
        overflow-y: auto;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
    `;

    content.innerHTML = `
        <h3 style="margin-top:0; margin-bottom: 15px; font-size:16px; color: #fff;">캐릭터 프롬프트 생성기</h3>

        <div style="margin-bottom: 10px;">
            <label style="display:block; font-size: 12px; margin-bottom: 5px; color: #bbb;">Gemini API Key</label>
            <div style="position: relative;">
                <input type="password" id="cp-api-key" placeholder="AI Studio에서 발급받은 키 입력" style="width: 100%; padding: 8px 35px 8px 8px; border-radius: 4px; border: 1px solid #444; background: #2d2d2d; color: #fff; box-sizing: border-box; font-size: 12px;">
                <span id="cp-toggle-eye" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); cursor: pointer; font-size: 14px; opacity: 0.7; user-select: none;">👁️</span>
            </div>
        </div>

        <div style="margin-bottom: 15px;">
            <label style="display:block; font-size: 12px; margin-bottom: 5px; color: #bbb;">AI 모델 선택</label>
            <select id="cp-model-select" style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid #444; background: #2d2d2d; color: #fff; box-sizing: border-box; font-size: 12px; outline: none; cursor: pointer;">
                <option value="gemini-3.6-flash">Gemini 3.6 Flash (무료/추천)</option>
                <option value="gemini-2.5-flash">Gemini 2.5 Flash (무료/최신)</option>
                <option value="gemini-1.5-flash">Gemini 1.5 Flash (무료/안정성)</option>
            </select>
        </div>

        <div style="background: #2a2a2a; padding: 10px; border-radius: 6px; margin-bottom: 15px; border: 1px solid #444;">
            <div id="cp-preset-toggle-header" style="display: flex; justify-content: space-between; align-items: center; cursor: pointer; user-select: none;">
                <label style="font-size: 13px; font-weight: bold; color: #fff; cursor: pointer; margin: 0;">📝 프롬프트 템플릿 관리</label>
                <span id="cp-preset-toggle-icon" style="font-size: 12px; color: #bbb;">▼</span>
            </div>

            <div id="cp-preset-content" style="margin-top: 12px; display: block;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <select id="cp-preset-select" style="flex-grow: 1; padding: 6px; border-radius: 4px; border: 1px solid #555; background: #1e1e1e; color: #fff; font-size: 12px; outline: none; margin-right: 8px;"></select>
                    <div style="flex-shrink: 0;">
                        <button id="cp-add-preset" style="padding: 4px 6px; background-color: #28a745; color: white; border: none; border-radius: 3px; font-size: 11px; cursor: pointer; margin-right: 3px;">➕ 추가</button>
                        <button id="cp-del-preset" style="padding: 4px 6px; background-color: #dc3545; color: white; border: none; border-radius: 3px; font-size: 11px; cursor: pointer;">🗑️ 삭제</button>
                    </div>
                </div>

                <input type="text" id="cp-preset-name" placeholder="프리셋 이름" style="width: 100%; padding: 6px; margin-bottom: 8px; border-radius: 4px; border: 1px solid #555; background: #1e1e1e; color: #fff; box-sizing: border-box; font-size: 12px;">

                <label style="display:block; font-size: 11px; margin-bottom: 3px; color: #bbb;">작성 규칙 (System Instruction)</label>
                <textarea id="cp-preset-rules" placeholder="AI에게 내릴 지침을 입력하세요." style="width: 100%; height: 90px; padding: 6px; margin-bottom: 8px; border-radius: 4px; border: 1px solid #555; background: #1e1e1e; color: #fff; box-sizing: border-box; font-size: 11px; resize: vertical;"></textarea>

                <label style="display:block; font-size: 11px; margin-bottom: 3px; color: #bbb;">레퍼런스 (원하는 출력 포맷 예시)</label>
                <textarea id="cp-preset-reference" placeholder="출력되길 원하는 형태의 예시를 입력하세요." style="width: 100%; height: 110px; padding: 6px; border-radius: 4px; border: 1px solid #555; background: #1e1e1e; color: #fff; box-sizing: border-box; font-size: 11px; resize: vertical;"></textarea>
            </div>
        </div>

        <div style="margin-bottom: 10px;">
            <label style="display:block; font-size: 12px; margin-bottom: 5px; color: #bbb;">💡 캐릭터 러프 아이디어</label>
            <textarea id="cp-user-idea" placeholder="예시: 20대 후반, 재벌 3세인데 겉으로는 다정하고 속은 통제광인 남자." style="width: 100%; height: 80px; padding: 8px; border-radius: 4px; border: 1px solid #444; background: #2d2d2d; color: #fff; box-sizing: border-box; font-size: 12px; resize: vertical;"></textarea>
        </div>

        <button id="cp-generate-btn" style="width: 100%; padding: 12px; background-color: #6f42c1; color: white; border: none; border-radius: 4px; font-weight: bold; cursor: pointer; margin-bottom: 15px; transition: background 0.2s;">프롬프트 생성하기</button>

        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
            <label style="font-size: 12px; color: #bbb;">생성 결과</label>
            <button id="cp-copy-btn" style="padding: 4px 8px; background-color: #444; color: white; border: none; border-radius: 4px; font-size: 11px; cursor: pointer;">복사하기</button>
        </div>

        <textarea id="cp-result-output" readonly placeholder="결과가 이곳에 출력됩니다." style="flex-grow: 1; min-height: 150px; width: 100%; padding: 10px; border-radius: 4px; border: 1px solid #444; background: #1a1a1a; color: #a9dc76; box-sizing: border-box; font-size: 12px; resize: vertical; white-space: pre-wrap; font-family: monospace;"></textarea>
    `;

    sidebar.appendChild(toggleBtn);
    sidebar.appendChild(content);
    document.body.appendChild(sidebar);

    // 

    let isOpen = false;
    toggleBtn.addEventListener('click', () => {
        isOpen = !isOpen;
        sidebar.style.right = isOpen ? '0' : '-450px';
    });

    const apiKeyInput = sidebar.querySelector('#cp-api-key');
    const toggleEye = sidebar.querySelector('#cp-toggle-eye');
    const modelSelect = sidebar.querySelector('#cp-model-select');
    const userIdeaInput = sidebar.querySelector('#cp-user-idea');
    const generateBtn = sidebar.querySelector('#cp-generate-btn');
    const resultOutput = sidebar.querySelector('#cp-result-output');
    const copyBtn = sidebar.querySelector('#cp-copy-btn');

    const presetToggleHeader = sidebar.querySelector('#cp-preset-toggle-header');
    const presetContent = sidebar.querySelector('#cp-preset-content');
    const presetToggleIcon = sidebar.querySelector('#cp-preset-toggle-icon');
    const presetSelect = sidebar.querySelector('#cp-preset-select');
    const presetNameInput = sidebar.querySelector('#cp-preset-name');
    const presetRulesInput = sidebar.querySelector('#cp-preset-rules');
    const presetRefInput = sidebar.querySelector('#cp-preset-reference');
    const btnAddPreset = sidebar.querySelector('#cp-add-preset');
    const btnDelPreset = sidebar.querySelector('#cp-del-preset');

    let isPresetOpen = true;
    presetToggleHeader.addEventListener('click', () => {
        isPresetOpen = !isPresetOpen;
        presetContent.style.display = isPresetOpen ? 'block' : 'none';
        presetToggleIcon.innerText = isPresetOpen ? '▼' : '▶';
    });

    toggleEye.addEventListener('click', () => {
        if (apiKeyInput.type === 'password') {
            apiKeyInput.type = 'text';
            toggleEye.innerText = '🙈';
            toggleEye.style.opacity = '1';
        } else {
            apiKeyInput.type = 'password';
            toggleEye.innerText = '👁️';
            toggleEye.style.opacity = '0.7';
        }
    });

    if (localStorage.getItem('cp_gemini_api_key')) apiKeyInput.value = localStorage.getItem('cp_gemini_api_key');
    if (localStorage.getItem('cp_gemini_model')) modelSelect.value = localStorage.getItem('cp_gemini_model');

    apiKeyInput.addEventListener('change', (e) => localStorage.setItem('cp_gemini_api_key', e.target.value.trim()));
    modelSelect.addEventListener('change', (e) => localStorage.setItem('cp_gemini_model', e.target.value));

    function renderPresets() {
        presetSelect.innerHTML = '';
        presets.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.innerText = p.name;
            presetSelect.appendChild(opt);
        });
        presetSelect.value = currentPresetId;
        loadCurrentPreset();
    }

    function loadCurrentPreset() {
        const current = presets.find(p => p.id === currentPresetId);
        if (current) {
            presetNameInput.value = current.name;
            presetRulesInput.value = current.rules;
            presetRefInput.value = current.reference;
        }
    }

    function savePresets() {
        const current = presets.find(p => p.id === currentPresetId);
        if (current) {
            current.name = presetNameInput.value || "새 프리셋";
            current.rules = presetRulesInput.value;
            current.reference = presetRefInput.value;

            const selectedOpt = presetSelect.querySelector(`option[value="${current.id}"]`);
            if (selectedOpt) selectedOpt.innerText = current.name;
        }
        localStorage.setItem('cp_prompt_presets', JSON.stringify(presets));
        localStorage.setItem('cp_current_preset_id', currentPresetId);
    }

    presetNameInput.addEventListener('input', savePresets);
    presetRulesInput.addEventListener('input', savePresets);
    presetRefInput.addEventListener('input', savePresets);

    presetSelect.addEventListener('change', (e) => {
        currentPresetId = e.target.value;
        loadCurrentPreset();
        savePresets();
    });

    btnAddPreset.addEventListener('click', () => {
        const newId = Date.now().toString();
        presets.push({
            id: newId,
            name: `새 템플릿 (${presets.length + 1})`,
            rules: "",
            reference: ""
        });
        currentPresetId = newId;
        renderPresets();
        savePresets();

        if (!isPresetOpen) presetToggleHeader.click();
    });

    btnDelPreset.addEventListener('click', () => {
        if (presets.length <= 1) {
            alert('최소 1개의 템플릿은 유지해야 합니다.');
            return;
        }
        if (confirm('현재 선택된 템플릿을 삭제하시겠습니까?')) {
            presets = presets.filter(p => p.id !== currentPresetId);
            currentPresetId = presets[0].id;
            renderPresets();
            savePresets();
        }
    });

    renderPresets();

    copyBtn.addEventListener('click', async () => {
        if (!resultOutput.value) return;
        try {
            await navigator.clipboard.writeText(resultOutput.value);
            const originalText = copyBtn.innerText;
            copyBtn.innerText = '복사 완료!';
            copyBtn.style.backgroundColor = '#28a745';
            setTimeout(() => {
                copyBtn.innerText = originalText;
                copyBtn.style.backgroundColor = '#444';
            }, 1500);
        } catch (err) {
            resultOutput.select();
            document.execCommand('copy');
            copyBtn.innerText = '복사 완료!';
            setTimeout(() => { copyBtn.innerText = '복사하기'; }, 1500);
        }
    });

    // 


    generateBtn.addEventListener('click', () => {
        const apiKey = apiKeyInput.value.trim();
        const selectedModel = modelSelect.value;
        const userIdea = userIdeaInput.value.trim();

        if (!apiKey) {
            alert('Gemini API Key를 입력해주세요.');
            return;
        }
        if (!userIdea) {
            alert('캐릭터 아이디어를 입력해주세요.');
            return;
        }

        const current = presets.find(p => p.id === currentPresetId);
        const dynamicSystemPrompt = `${current.rules}\n\n[레퍼런스 예시]\n${current.reference}`;

        generateBtn.innerText = '생성 중... (약 10~20초 소요)';
        generateBtn.disabled = true;
        generateBtn.style.backgroundColor = '#444';
        resultOutput.value = '';

        GM_xmlhttpRequest({
            method: "POST",
            url: "https://generativelanguage.googleapis.com/v1beta/interactions",
            headers: {
                "Content-Type": "application/json",
                "x-goog-api-key": apiKey
            },
            data: JSON.stringify({
                model: selectedModel,
                system_instruction: dynamicSystemPrompt,
                input: userIdea,
                generation_config: {
                    temperature: 0.7
                }
            }),
            onload: function(response) {
                try {
                    const data = JSON.parse(response.responseText);

                    if (response.status !== 200) {
                        const errorMessage = data?.error?.message || data?.message || `HTTP ${response.status}`;
                        throw new Error(errorMessage);
                    }

                    let generatedText = '';

                    if (typeof data.output_text === 'string') {
                        generatedText = data.output_text;
                    }

                    if (!generatedText && Array.isArray(data.steps)) {
                        const modelOutputs = data.steps.filter(step => step.type === 'model_output');
                        for (const step of modelOutputs) {
                            if (!Array.isArray(step.content)) continue;
                            for (const content of step.content) {
                                if (content.type === 'text' && typeof content.text === 'string') {
                                    generatedText += content.text;
                                }
                            }
                        }
                    }

                    if (!generatedText) {
                        throw new Error('응답 데이터를 처리하는 중 텍스트를 찾지 못했습니다.');
                    }

                    resultOutput.value = generatedText.trim();

                } catch (error) {
                    resultOutput.value = '오류가 발생했습니다:\n\n' + error.message;
                } finally {
                    generateBtn.innerText = '프롬프트 생성하기';
                    generateBtn.disabled = false;
                    generateBtn.style.backgroundColor = '#6f42c1';
                }
            },
            onerror: function(err) {
                resultOutput.value = '네트워크 오류가 발생했습니다.\n현재 접속 중인 사이트의 보안 설정이나 인터넷 연결 상태를 확인해주세요.';
                generateBtn.innerText = '프롬프트 생성하기';
                generateBtn.disabled = false;
                generateBtn.style.backgroundColor = '#6f42c1';
            },
            ontimeout: function() {
                resultOutput.value = '서버 응답 시간이 초과되었습니다. 다시 시도해주세요.';
                generateBtn.innerText = '프롬프트 생성하기';
                generateBtn.disabled = false;
                generateBtn.style.backgroundColor = '#6f42c1';
            }
        });
    });

})();