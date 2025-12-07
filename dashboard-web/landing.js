console.log("Welcome to Project Owl Landing Page!");

// Smooth scrolling for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const targetId = this.getAttribute('href');
        const target = document.querySelector(targetId);
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth'
            });
        }
    });
});

// Custom Cursor Logic
const cursor = document.getElementById('customCursor');

if (cursor) {
    let mouseX = -100;
    let mouseY = -100;
    let cursorX = -100;
    let cursorY = -100;

    document.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;

        // Show cursor on first move
        if (!cursor.classList.contains('active')) {
            cursor.classList.add('active');
        }

        // Check for hover state
        const target = e.target;
        const isClickable = target.closest('a') ||
            target.closest('button') ||
            target.closest('input') ||
            target.closest('[role="button"]') ||
            window.getComputedStyle(target).cursor === 'pointer';

        if (isClickable) {
            cursor.classList.add('hovering');
        } else {
            cursor.classList.remove('hovering');
        }
    });

    function animateCursor() {
        // Simple lerp for smooth following
        const dx = mouseX - cursorX;
        const dy = mouseY - cursorY;

        cursorX += dx * 0.15; // Adjust speed here
        cursorY += dy * 0.15;

        cursor.style.transform = `translate(${cursorX}px, ${cursorY}px)`;

        requestAnimationFrame(animateCursor);
    }

    // Start animation loop
    animateCursor();

    // Hide cursor when leaving window
    document.addEventListener('mouseleave', () => {
        cursor.classList.remove('active');
    });

    document.addEventListener('mouseenter', () => {
        cursor.classList.add('active');
    });
}
