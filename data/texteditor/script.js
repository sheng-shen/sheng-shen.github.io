document.addEventListener('DOMContentLoaded', () => {
    const editableBox = document.querySelector('.editable-box');
    const customCaret = document.createElement('div');
    customCaret.classList.add('custom-caret');
    document.body.appendChild(customCaret);
    editableBox.addEventListener('input', updateCaretPosition);
    editableBox.addEventListener('click', updateCaretPosition);
    editableBox.addEventListener('keyup', updateCaretPosition);
    function updateCaretPosition() {
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            customCaret.style.top = `${rect.top + window.scrollY}px`;
            customCaret.style.left = `${rect.left + window.scrollX - 3}px`; // Adjusted 2 pixels to the left
            customCaret.style.height = `${rect.height}px`;
        }
    }
});