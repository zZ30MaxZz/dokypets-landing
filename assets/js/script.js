// Simple JavaScript for Dokypets Landing Page

document.addEventListener('DOMContentLoaded', function() {
    // Mobile menu toggle (if we had one)
    const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
    const navList = document.querySelector('.nav-list');
    
    if (mobileMenuBtn && navList) {
        mobileMenuBtn.addEventListener('click', function() {
            navList.classList.toggle('active');
        });
    }
    
    // Smooth scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            
            const targetId = this.getAttribute('href');
            if (targetId !== '#') {
                const targetElement = document.querySelector(targetId);
                if (targetElement) {
                    window.scrollTo({
                        top: targetElement.offsetTop - 80,
                        behavior: 'smooth'
                    });
                }
            }
        });
    });
    
    // Form validation and submission
    const contactForm = document.getElementById('contactForm');
    if (contactForm) {
        contactForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            // Simple validation
            const inputs = this.querySelectorAll('input[required], textarea[required]');
            let isValid = true;
            
            inputs.forEach(input => {
                if (!input.value.trim()) {
                    isValid = false;
                    input.style.borderColor = '#e74c3c';
                } else {
                    input.style.borderColor = '#ddd';
                }
            });
            
            if (isValid) {
                // In a real application, you would send this to a backend
                alert('¡Gracias por tu mensaje! Nos pondremos en contacto contigo pronto.');
                this.reset();
            } else {
                alert('Por favor, completa todos los campos requeridos.');
            }
        });
    }
    
    // Add some interactivity to service cards
    const serviceCards = document.querySelectorAll('.service-card');
    serviceCards.forEach(card => {
        card.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-10px)';
            this.style.boxShadow = '0 15px 30px rgba(0,0,0,0.12)';
        });
        
        card.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0)';
            this.style.boxShadow = '0 5px 15px rgba(0,0,0,0.08)';
        });
    });
});