
const gameContainer = document.querySelector('.container');
const allMoleItems = document.querySelectorAll('.item');
let moleTimer;
let startTime;
let allowRestart = true;
let countDown = 0;
let score = 0;

const timeCount = document.getElementById('time-count');
const scoreCount = document.getElementById('score-count');
const startPrompt = document.getElementById('startprompt');

gameContainer.addEventListener('click', function(e){
    if(e.target.classList.contains('mole-clicked')){
        score++;
        scoreCount.innerHTML = score;

        const bushElem = e.target.parentElement.previousElementSibling;
        const moleItem = e.target.parentElement;

        let textEl = document.createElement('span');
        textEl.setAttribute('class', 'whack-text');
        textEl.innerHTML = "whack!";
        bushElem.appendChild(textEl);

        moleItem.classList.remove('mole-appear');

        setTimeout(() => {
            textEl.remove();
        }, 300);
    }

    if(countDown === 0 && allowRestart) {
        startPrompt.style.display = "none";
        resetGames();
    }
})

// document.addEventListener('DOMContentLoaded', () => {
//     resetGames();
// });

// shows mole
function showMole(){
    if (countDown <= 0) {
        return;
    }

    let moleToAppear = allMoleItems[getRandomValue(0, allMoleItems.length)].querySelector('.mole');
    moleToAppear.classList.add('mole-appear');
    hideMole(moleToAppear);

    moleTimer = setTimeout(() => {
        showMole();
    }, getRandomValue(900, 2000));

}

function getRandomValue(min, max){
    let rand = Math.random() * (max - min) + min;
    return Math.floor(rand);
}

// hide Mole
function hideMole(moleItem){
    setTimeout(() => {
        moleItem.classList.remove('mole-appear');
    }, 3000);
}

function resetGames(){
    score = 0;
    moleTimer, startTime, countDown = 20;


    timeCount.innerHTML = countDown;
    scoreCount.innerHTML = score;
    //countDown--;

    // total game time is 20 seconds
    startTime = setInterval(() => {
        countDown--;
        timeCount.innerHTML = countDown;

        if(countDown <= 0){
            clearInterval(moleTimer);
            clearInterval(startTime);
            timeCount.innerHTML = "0";
            startPrompt.style.display = "";

            for (const mole of allMoleItems) {
                mole.classList.remove('mole-appear');
            }

            allowRestart = false;
            setTimeout(() => {
                allowRestart = true;
            }, 3000);

            return;
        }
    }, 1000);

    showMole();

    // startGame = setInterval(() => {
    //     showMole();
    // }, 1000);
}
