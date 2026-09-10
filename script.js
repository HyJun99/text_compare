const editorView = document.getElementById("editorView");
const diffView = document.getElementById("diffView");

const originalText = document.getElementById("originalText");
const compareText = document.getElementById("compareText");

const compareBtn = document.getElementById("compareBtn");
const backBtn = document.getElementById("backBtn");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");

const counter = document.getElementById("counter");
const summary = document.getElementById("summary");

const leftPaneBody = document.getElementById("leftPaneBody");
const rightPaneBody = document.getElementById("rightPaneBody");

let diffRows = [];
let diffIndexes = [];
let currentDiffPosition = -1;

function splitLines(text) {
    return text.split("\n");
}

function createLineOperations(oldLines, newLines) {
    const m = oldLines.length;
    const n = newLines.length;

    const dp = Array.from(
        { length: m + 1 },
        () => new Uint32Array(n + 1)
    );

    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (oldLines[i - 1] === newLines[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1] + 1;
            } else {
                dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
            }
        }
    }

    const operations = [];
    let i = m;
    let j = n;

    while (i > 0 || j > 0) {
        if (
            i > 0 &&
            j > 0 &&
            oldLines[i - 1] === newLines[j - 1]
        ) {
            operations.push({
                type: "same",
                text: oldLines[i - 1],
                oldLineNumber: i,
                newLineNumber: j
            });
            i--;
            j--;
        }
        else if (
            j > 0 &&
            (i === 0 || dp[i][j - 1] >= dp[i - 1][j])
        ) {
            operations.push({
                type: "added",
                text: newLines[j - 1],
                newLineNumber: j
            });
            j--;
        }
        else {
            operations.push({
                type: "removed",
                text: oldLines[i - 1],
                oldLineNumber: i
            });
            i--;
        }
    }

    return operations.reverse();
}

function isWhitespaceOnlyChange(oldText, newText) {
    if (oldText === newText) {
        return false;
    }

    const oldWithoutSpace = oldText.replace(/[ \t]/g, "");
    const newWithoutSpace = newText.replace(/[ \t]/g, "");

    return oldWithoutSpace === newWithoutSpace;
}

function alignLineOperations(operations) {
    const rows = [];
    let index = 0;

    while (index < operations.length) {
        const operation = operations[index];

        if (operation.type === "same") {
            rows.push({
                type: "same",
                left: {
                    lineNumber: operation.oldLineNumber,
                    text: operation.text
                },
                right: {
                    lineNumber: operation.newLineNumber,
                    text: operation.text
                }
            });

            index++;
            continue;
        }

        const removed = [];
        const added = [];

        while (index < operations.length && operations[index].type !== "same") {
            const current = operations[index];

            if (current.type === "removed") {
                removed.push(current);
            }
            else if (current.type === "added") {
                added.push(current);
            }

            index++;
        }

        const maxLength = Math.max(removed.length, added.length);

        for (let i = 0; i < maxLength; i++) {
            const oldLine = removed[i];
            const newLine = added[i];

            if (oldLine && newLine) {
                let type = "changed";

                if (isWhitespaceOnlyChange(oldLine.text, newLine.text)) {
                    type = "whitespace";
                }

                rows.push({
                    type,
                    left: {
                        lineNumber: oldLine.oldLineNumber,
                        text: oldLine.text
                    },
                    right: {
                        lineNumber: newLine.newLineNumber,
                        text: newLine.text
                    }
                });
            }
            else if (oldLine) {
                rows.push({
                    type: "deleted",
                    left: {
                        lineNumber: oldLine.oldLineNumber,
                        text: oldLine.text
                    },
                    right: null
                });
            }
            else if (newLine) {
                rows.push({
                    type: "added",
                    left: null,
                    right: {
                        lineNumber: newLine.newLineNumber,
                        text: newLine.text
                    }
                });
            }
        }
    }

    return rows;
}

function createCharacterOperations(oldText, newText) {
    const oldChars = Array.from(oldText);
    const newChars = Array.from(newText);

    const m = oldChars.length;
    const n = newChars.length;

    if (m > 700 || n > 700) {
        return [
            { type: "removed", text: oldText },
            { type: "added", text: newText }
        ];
    }

    const dp = Array.from(
        { length: m + 1 },
        () => new Uint16Array(n + 1)
    );

    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (oldChars[i - 1] === newChars[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1] + 1;
            }
            else {
                dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
            }
        }
    }

    const operations = [];
    let i = m;
    let j = n;

    while (i > 0 || j > 0) {
        if (
            i > 0 &&
            j > 0 &&
            oldChars[i - 1] === newChars[j - 1]
        ) {
            operations.push({
                type: "same",
                text: oldChars[i - 1]
            });
            i--;
            j--;
        }
        else if (
            j > 0 &&
            (i === 0 || dp[i][j - 1] >= dp[i - 1][j])
        ) {
            operations.push({
                type: "added",
                text: newChars[j - 1]
            });
            j--;
        }
        else {
            operations.push({
                type: "removed",
                text: oldChars[i - 1]
            });
            i--;
        }
    }

    return operations.reverse();
}

function createInlineDiff(oldText, newText, side) {
    const fragment = document.createDocumentFragment();
    const operations = createCharacterOperations(oldText, newText);

    let buffer = "";
    let currentClass = null;

    function flush() {
        if (buffer === "") {
            return;
        }

        const span = document.createElement("span");
        span.textContent = buffer;

        if (currentClass) {
            span.className = currentClass;
        }

        fragment.appendChild(span);
        buffer = "";
    }

    function addCharacter(character, className) {
        if (currentClass !== className) {
            flush();
            currentClass = className;
        }

        buffer += character;
    }

    for (const operation of operations) {
        if (operation.type === "same") {
            addCharacter(operation.text, null);
            continue;
        }

        if (side === "left" && operation.type !== "removed") {
            continue;
        }

        if (side === "right" && operation.type !== "added") {
            continue;
        }

        const isWhitespace = /^[ \t]+$/.test(operation.text);

        if (isWhitespace) {
            addCharacter(operation.text, "token-whitespace");
        }
        else {
            addCharacter(operation.text, "token-changed");
        }
    }

    flush();
    return fragment;
}

function getMarker(type, side, hasData) {
    if (!hasData) {
        return "";
    }

    switch (type) {
        case "changed":
            return "~";
        case "whitespace":
            return "·";
        case "added":
            return side === "right" ? "+" : "";
        case "deleted":
            return side === "left" ? "-" : "";
        default:
            return "";
    }
}

function createPaneLine(row, sideName, rowIndex) {
    const line = document.createElement("div");
    line.className = "diff-line";
    line.dataset.rowIndex = rowIndex;

    const data = sideName === "left" ? row.left : row.right;
    const hasData = !!data;

    if (row.type !== "same") {
        line.classList.add("has-diff");
        line.classList.add(`type-${row.type}`);
    }

    if (!hasData) {
        line.classList.add("placeholder");
    }

    const marker = document.createElement("div");
    marker.className = "change-marker";
    marker.textContent = getMarker(row.type, sideName, hasData);

    const lineNumber = document.createElement("div");
    lineNumber.className = "line-number";
    lineNumber.textContent = hasData ? data.lineNumber : "";

    const content = document.createElement("div");
    content.className = "line-content";

    if (!hasData) {
        content.textContent = " ";
    }
    else if (row.type === "same") {
        content.textContent = data.text === "" ? " " : data.text;
    }
    else if (row.type === "added") {
        if (sideName === "right") {
            const span = document.createElement("span");
            span.className = "token-added";
            span.textContent = data.text === "" ? " " : data.text;
            content.appendChild(span);
        }
        else {
            content.textContent = " ";
        }
    }
    else if (row.type === "deleted") {
        if (sideName === "left") {
            const span = document.createElement("span");
            span.className = "token-deleted";
            span.textContent = data.text === "" ? " " : data.text;
            content.appendChild(span);
        }
        else {
            content.textContent = " ";
        }
    }
    else {
        content.appendChild(
            createInlineDiff(row.left.text, row.right.text, sideName)
        );
    }

    line.appendChild(marker);
    line.appendChild(lineNumber);
    line.appendChild(content);

    return line;
}

function renderDiff() {
    leftPaneBody.replaceChildren();
    rightPaneBody.replaceChildren();

    diffIndexes = [];

    diffRows.forEach((row, index) => {
        const leftLine = createPaneLine(row, "left", index);
        const rightLine = createPaneLine(row, "right", index);

        leftPaneBody.appendChild(leftLine);
        rightPaneBody.appendChild(rightLine);

        if (row.type !== "same") {
            diffIndexes.push(index);
        }
    });

    updateSummary();
}

function updateSummary() {
    let changed = 0;
    let whitespace = 0;
    let added = 0;
    let deleted = 0;

    for (const row of diffRows) {
        switch (row.type) {
            case "changed":
                changed++;
                break;
            case "whitespace":
                whitespace++;
                break;
            case "added":
                added++;
                break;
            case "deleted":
                deleted++;
                break;
        }
    }

    const total = changed + whitespace + added + deleted;

    if (total === 0) {
        summary.textContent = "✓ 두 파일이 완전히 같습니다.";
        counter.textContent = "0 / 0";
        prevBtn.disabled = true;
        nextBtn.disabled = true;
        return;
    }

    summary.textContent =
        `수정 ${changed} · 공백 ${whitespace} · 신규 ${added} · 삭제 ${deleted}`;

    prevBtn.disabled = false;
    nextBtn.disabled = false;
}

function clearActive() {
    document.querySelectorAll(".diff-line.active").forEach((element) => {
        element.classList.remove("active");
    });
}

function showDifference(position) {
    if (diffIndexes.length === 0) {
        return;
    }

    clearActive();

    currentDiffPosition = position;
    const rowIndex = diffIndexes[currentDiffPosition];

    const elements = document.querySelectorAll(
        `.diff-line[data-row-index="${rowIndex}"]`
    );

    elements.forEach((element) => {
        element.classList.add("active");
    });

    const leftTarget = leftPaneBody.querySelector(
        `.diff-line[data-row-index="${rowIndex}"]`
    );

    const rightTarget = rightPaneBody.querySelector(
        `.diff-line[data-row-index="${rowIndex}"]`
    );

    if (leftTarget) {
        leftPaneBody.scrollTop =
            leftTarget.offsetTop - leftPaneBody.clientHeight / 2;
    }

    if (rightTarget) {
        rightPaneBody.scrollTop =
            rightTarget.offsetTop - rightPaneBody.clientHeight / 2;
    }

    counter.textContent =
        `${currentDiffPosition + 1} / ${diffIndexes.length}`;
}

compareBtn.addEventListener("click", function () {
    const oldValue = originalText.value;
    const newValue = compareText.value;

    const oldLines = splitLines(oldValue);
    const newLines = splitLines(newValue);

    const operations = createLineOperations(oldLines, newLines);
    diffRows = alignLineOperations(operations);

    renderDiff();

    editorView.classList.add("hidden");
    diffView.classList.remove("hidden");

    if (diffIndexes.length > 0) {
        showDifference(0);
    }
});

nextBtn.addEventListener("click", function () {
    if (diffIndexes.length === 0) {
        return;
    }

    let next = currentDiffPosition + 1;

    if (next >= diffIndexes.length) {
        next = 0;
    }

    showDifference(next);
});

prevBtn.addEventListener("click", function () {
    if (diffIndexes.length === 0) {
        return;
    }

    let previous = currentDiffPosition - 1;

    if (previous < 0) {
        previous = diffIndexes.length - 1;
    }

    showDifference(previous);
});

backBtn.addEventListener("click", function () {
    diffView.classList.add("hidden");
    editorView.classList.remove("hidden");
});
