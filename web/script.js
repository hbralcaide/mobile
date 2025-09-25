// Supabase configuration
const SUPABASE_URL = 'https://udxoepcssfhljwqbvhbd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkeG9lcGNzc2ZobGp3cWJ2aGJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM3NzQyNTksImV4cCI6MjA2OTM1MDI1OX0.CCpVQSyzuDs6sIEEZ42phS7ISKiM-rFfojv1YECpgM0';

// Initialize Supabase client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// DOM elements
const loadingDiv = document.getElementById('loading');
const errorDiv = document.getElementById('error');
const errorMessage = document.getElementById('error-message');
const signupForm = document.getElementById('signup-form');
const successDiv = document.getElementById('success');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const confirmPasswordInput = document.getElementById('confirm-password');
const submitBtn = document.getElementById('submit-btn');
const submitText = document.getElementById('submit-text');
const submitSpinner = document.getElementById('submit-spinner');

// Get URL parameters
function getUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    return {
        token_hash: urlParams.get('token_hash') || urlParams.get('token'),
        type: urlParams.get('type') || 'invite'
    };
}

// Show specific section
function showSection(section) {
    const sections = [loadingDiv, errorDiv, signupForm, successDiv];
    sections.forEach(s => s.classList.add('hidden'));
    section.classList.remove('hidden');
}

// Show error
function showError(message) {
    errorMessage.textContent = message;
    showSection(errorDiv);
}

// Validate invitation token
async function validateInvitation() {
    showSection(loadingDiv);
    
    try {
        const { token_hash, type } = getUrlParams();
        
        console.log('Validating invitation with params:', { token_hash, type });
        
        if (!token_hash) {
            throw new Error('Invalid invitation link - missing token');
        }

        // Verify the invitation token
        const { data, error } = await supabase.auth.verifyOtp({
            token_hash,
            type: 'invite'
        });

        console.log('Verification result:', { data, error });

        if (error) {
            throw new Error(error.message || 'Invalid or expired invitation');
        }

        if (!data?.user?.email) {
            throw new Error('Invalid invitation - no email found');
        }

        // Pre-fill email and show form
        emailInput.value = data.user.email;
        showSection(signupForm);
        passwordInput.focus();

    } catch (error) {
        console.error('Validation error:', error);
        showError(error.message || 'Invalid or expired invitation link');
    }
}

// Validate form inputs
function validateForm() {
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    // Clear previous errors
    document.querySelectorAll('.field-error').forEach(el => el.remove());
    document.querySelectorAll('.input-error').forEach(el => el.classList.remove('input-error'));

    let isValid = true;

    // Validate email
    if (!email) {
        showFieldError(emailInput, 'Email is required');
        isValid = false;
    }

    // Validate password
    if (!password) {
        showFieldError(passwordInput, 'Password is required');
        isValid = false;
    } else if (password.length < 8) {
        showFieldError(passwordInput, 'Password must be at least 8 characters long');
        isValid = false;
    }

    // Validate confirm password
    if (!confirmPassword) {
        showFieldError(confirmPasswordInput, 'Please confirm your password');
        isValid = false;
    } else if (password !== confirmPassword) {
        showFieldError(confirmPasswordInput, 'Passwords do not match');
        isValid = false;
    }

    return isValid;
}

// Show field error
function showFieldError(input, message) {
    input.classList.add('input-error');
    const errorEl = document.createElement('div');
    errorEl.className = 'field-error';
    errorEl.textContent = message;
    input.parentNode.appendChild(errorEl);
}

// Handle form submission
async function handleSubmit(event) {
    event.preventDefault();
    
    if (!validateForm()) {
        return;
    }

    // Show loading state
    submitBtn.disabled = true;
    submitText.classList.add('hidden');
    submitSpinner.classList.remove('hidden');

    try {
        const email = emailInput.value.trim();
        const password = passwordInput.value;

        // Sign up with Supabase
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    role: 'admin',
                    signupMethod: 'invitation',
                },
                emailRedirectTo: `${window.location.origin}/verify` // For email verification
            }
        });

        if (error) {
            throw new Error(error.message);
        }

        if (data?.user) {
            showSection(successDiv);
        } else {
            throw new Error('Failed to create account');
        }

    } catch (error) {
        console.error('Signup error:', error);
        showError(error.message || 'An unexpected error occurred during registration');
    } finally {
        // Reset button state
        submitBtn.disabled = false;
        submitText.classList.remove('hidden');
        submitSpinner.classList.add('hidden');
    }
}

// Event listeners
signupForm.addEventListener('submit', handleSubmit);

// Real-time password validation
confirmPasswordInput.addEventListener('input', () => {
    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;
    
    if (confirmPassword && password !== confirmPassword) {
        confirmPasswordInput.classList.add('input-error');
    } else {
        confirmPasswordInput.classList.remove('input-error');
    }
});

// Initialize the page
document.addEventListener('DOMContentLoaded', () => {
    validateInvitation();
});
