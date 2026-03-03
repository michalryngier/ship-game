// Function to show the modal with the provided text
function showModal(text) {
    const modal = document.getElementById('custom-modal');
    const modalText = document.getElementById('custom-modal-text');
    const overlay = document.getElementById('custom-modal-overlay');

    modalText.textContent = text;
    modal.style.display = 'block';
    overlay.style.display = 'block';
}

// Function to close the modal
function closeModal() {
    const modal = document.getElementById('custom-modal');
    const overlay = document.getElementById('custom-modal-overlay');

    modal.style.display = 'none';
    overlay.style.display = 'none';
}

// Wait for the DOM content to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('custom-modal');
    const modalOverlay = document.getElementById('custom-modal-overlay');
    const modalOkButton = document.getElementById('custom-modal-ok-button');

    // Close modal when clicking outside of it
    modalOverlay.addEventListener('click', closeModal);

    // Close modal when clicking the OK button
    modalOkButton.addEventListener('click', closeModal);

    // Expose the functions globally
    window.showModal = showModal;
    window.closeModal = closeModal;
});
