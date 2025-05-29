document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const errorMessageElement = document.getElementById('loginErrorMessage');

    if (loginForm) {
        loginForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            errorMessageElement.textContent = '';
            errorMessageElement.style.display = 'none';

            const username = loginForm.username.value;
            const password = loginForm.password.value;

            try {
                const response = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ username, password }),
                });

                const data = await response.json();

                if (response.ok) {
                    // Login successful
                    window.location.href = '/'; // Redirect to the main wiki page
                } else {
                    // Login failed
                    errorMessageElement.textContent = data.message || 'Login failed. Please try again.';
                    errorMessageElement.style.display = 'block';
                }
            } catch (error) {
                console.error('Login request error:', error);
                errorMessageElement.textContent = 'An error occurred. Please try again later.';
                errorMessageElement.style.display = 'block';
            }
        });
    }
});