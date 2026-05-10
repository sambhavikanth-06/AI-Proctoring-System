let questions = [
    { 
        id: 1, 
        text: "What is the correct extension of a Python file?", 
        options: [".py", ".python", ".pyt", ".exe"] 
    },
    { 
        id: 2, 
        text: "Which of the following is used for comments in Python?", 
        options: ["//", "#", "/* */", ""] 
    },
    { 
        id: 3, 
        text: "Which keyword is used to create a function in Python?", 
        options: ["function", "def", "func", "define"] 
    }
];

let currentIndex = 0;
let userAnswers = {}; 
let examSubmitted = false;

// Check if returning from page reload after submission
window.addEventListener('load', () => {
    console.log("Page loaded - checking session state");
    if (sessionStorage.getItem('examSubmitted') === 'true') {
        console.log("Exam was previously submitted - restoring result view");
        examSubmitted = true;
        const score = sessionStorage.getItem('examScore');
        const total = sessionStorage.getItem('examTotal');
        
        if (score && total) {
            document.querySelector(".main-layout").style.display = "none";
            document.getElementById("resultOverlay").style.display = "block";
            document.getElementById("resultBox").style.display = "block";
            document.getElementById("scoreText").innerText = `Your Score: ${score} / ${total}`;
            console.log("Results restored from session");
        }
    }
});

// Prevent page reload when exam is submitted
window.addEventListener('beforeunload', (e) => {
    if (examSubmitted) {
        console.log("Exam submitted - allowing page close");
        return;
    }
    // Optionally prevent accidental navigation during exam
    // e.preventDefault();
    // e.returnValue = '';
}); 

//  FETCH FROM DATABASE
async function loadQuestionsFromDB() {
    try {
        const res = await fetch("http://localhost:3000/api/exam/questions");
        const data = await res.json();
        console.log(data);

        questions = data.map(q => {
    const opts = [
    q.option_a,
    q.option_b,
    q.option_c,
    q.option_d
].filter(opt => opt);

    let correctText = "";

   if (q.correct_answer === "A") correctText = q.option_a;
if (q.correct_answer === "B") correctText = q.option_b;
if (q.correct_answer === "C") correctText = q.option_c;
if (q.correct_answer === "D") correctText = q.option_d;
    return {
    id: q.question_id,
   text: q.question_text || "Question",
    options: opts,
    correct_answer: correctText
};
});
        currentIndex = 0;
        updateExamUI(0);

        const palette = document.getElementById("palette");
        palette.innerHTML = "";

        questions.forEach((q, index) => {
            const span = document.createElement("span");
            span.innerText = index + 1;

            span.addEventListener("click", () => {
                currentIndex = index;
                updateExamUI(index);
            });

            palette.appendChild(span);
        });

    } catch (err) {
        console.log(err);
        alert("DB load failed, fallback to dummy questions");
        updateExamUI(0);
    }
}

// UI UPDATE
function updateExamUI(index) {
    const container = document.getElementById("questions");
    const paletteSpans = document.querySelectorAll('.grid span');

    const q = questions[index];

    container.innerHTML = `
        <p class="q-text"><b>Q${index + 1}. ${q.text}</b></p>
        <div class="options">
            ${q.options.map(opt => `
                <label>
                    <input type="radio" name="q${q.id}" value="${opt}" ${userAnswers[q.id] === opt ? "checked" : ""}>
                    ${opt}
                </label>
            `).join('')}
        </div>
    `;

    const radios = container.querySelectorAll('input[type="radio"]');
    radios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            userAnswers[q.id] = e.target.value;
        });
    });

    paletteSpans.forEach((span, i) => {
        span.classList.remove("active", "answered");

        if (i === index) {
            span.classList.add("active");
        }

        const qId = questions[i].id;

        if (userAnswers[qId]) {
            span.classList.add("answered");
        }
    });
}

// PREV
document.querySelector('.btn-prev').addEventListener('click', () => {
    if (currentIndex > 0) {
        currentIndex--;
        updateExamUI(currentIndex);
    }
});

// NEXT (FIXED)
document.querySelector('.btn-next').addEventListener('click', () => {

    if (currentIndex < questions.length - 1) {
        currentIndex++;
        updateExamUI(currentIndex);
    } else {
        alert("This is the last question.");
    }
});

// SUBMIT (FIXED)
document.querySelector('.btn-submit').addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();

    console.log("Submit button clicked");

    let answers = [];

    questions.forEach(q => {
        let selected = userAnswers[q.id];
        let selectedOption = "";

        if (selected === q.options[0]) selectedOption = "A";
        if (selected === q.options[1]) selectedOption = "B";
        if (selected === q.options[2]) selectedOption = "C";
        if (selected === q.options[3]) selectedOption = "D";

        answers.push({
            question_id: q.id,
            selected_option: selectedOption
        });
    });

    // Mark exam as submitted
    examSubmitted = true;
    console.log("Exam marked as submitted");

    // Hide main layout and show result immediately
    document.querySelector(".main-layout").style.display = "none";
    document.getElementById("resultOverlay").style.display = "block";
    document.getElementById("resultBox").style.display = "block";
    clearInterval(timerInterval);
    time = 0;

    console.log("Result box displayed");
    
    const submitStatus = document.getElementById("submitStatus");
    submitStatus.innerText = "Submitting answers to server...";

    try {
        console.log("Sending submit request...");
        const response = await fetch("http://localhost:3000/api/result/submit", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${localStorage.getItem("token")}`
            },
            body: JSON.stringify({
                exam_id: 1,
                answers: answers
            })
        });

        console.log("Response received:", response.status);
        
        if (!response.ok) {
            throw new Error(`Server returned ${response.status}`);
        }

        const data = await response.json();
        console.log("Response data:", data);
        
        // Save to session storage in case of page reload
        sessionStorage.setItem('examSubmitted', 'true');
        sessionStorage.setItem('examScore', data.score);
        sessionStorage.setItem('examTotal', questions.length);
        
        submitStatus.innerText = "Results saved successfully!";

        document.getElementById("scoreText").innerText =
            `Your Score: ${data.score} / ${questions.length}`;

    } catch (err) {
        console.error("Submit error:", err);
        submitStatus.innerText = `Error saving results: ${err.message}`;
        
        // Show result even if submission fails - use calculated score
        let score = 0;
        questions.forEach(q => {
            if (userAnswers[q.id] === q.correct_answer) {
                score++;
            }
        });
        
        // Save to session storage
        sessionStorage.setItem('examSubmitted', 'true');
        sessionStorage.setItem('examScore', score);
        sessionStorage.setItem('examTotal', questions.length);
        
        document.getElementById("scoreText").innerText =
            `Your Score: ${score} / ${questions.length}`;
    }

    return false;
});

// CONTINUE BUTTON
document.getElementById('continueBtn').addEventListener('click', () => {
    console.log("Continue button clicked");
    // Clear session storage
    sessionStorage.removeItem('examSubmitted');
    sessionStorage.removeItem('examScore');
    sessionStorage.removeItem('examTotal');
    // Redirect to login page
    window.location.href = 'Login.html';
});

function calculateScoreAndSubmit() {

    let score = 0;

    questions.forEach(q => {
        if (userAnswers[q.id] === q.correct_answer) {
            score++;
        }
    });

    clearInterval(timerInterval);
    time = 0;

    document.querySelector(".main-layout").style.display = "none";

    document.getElementById("resultBox").style.display = "block";

    document.getElementById("scoreText").innerText =
        `Your Score: ${score} / ${questions.length}`;
}

// LOAD QUESTIONS
loadQuestionsFromDB();

// TIMER
let time = 3600;

let timerInterval = setInterval(() => {
    if (time <= 0) {
        calculateScoreAndSubmit();
        return;
    }

    let mins = Math.floor(time / 60);
    let secs = time % 60;

    document.getElementById('time').innerHTML = 
        `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

    time--;
}, 1000);

// START CAMERA
async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: true
        });

        const video = document.getElementById("webcam");

        video.srcObject = stream;

        console.log("Camera connected");

    } catch (err) {
        console.error("Camera error:", err);
        alert("Camera permission denied");
    }
}

startCamera();

// Prevent any page reloads after exam is submitted
window.addEventListener('beforeunload', (e) => {
    if (examSubmitted) {
        console.log("Exam submitted - allowing page unload");
        return;
    }
    // Log if page is unloading before exam is submitted
    console.warn("Page unloading before exam submission");
});

// Monitor for any navigation attempts
window.addEventListener('popstate', (e) => {
    console.warn("Browser navigation detected");
    if (examSubmitted) {
        e.preventDefault();
        history.pushState(null, null, window.location.href);
    }
});

// Prevent accidentally going back
history.pushState(null, null, window.location.href);