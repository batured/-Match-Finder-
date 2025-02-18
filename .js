function getPotentialMatches(userId, limit = 10) {
    const currentUserProfile = getProfileByUserId(userId);
    if (!currentUserProfile) return [];
    
    const profiles = getData(DB_KEYS.PROFILES);
    const likes = getData(DB_KEYS.LIKES);
    const matches = getData(DB_KEYS.MATCHES);

    // Filter out profiles that don't match the current user's preferences
    const potentialMatches = profiles.filter(profile => {
        // Exclude the current user's profile
        if (profile.userId === userId) return false;

        // Check age range
        if (profile.age < currentUserProfile.preferences.ageMin || profile.age > currentUserProfile.preferences.ageMax) {
            return false;
        }

        // Check gender preferences
        if (currentUserProfile.preferences.genderPreferences.length > 0 && 
            !currentUserProfile.preferences.genderPreferences.includes(profile.gender)) {
            return false;
        }

        // Check if already matched or liked
        const alreadyLiked = likes.some(like => like.likerId === userId && like.likedId === profile.userId);
        const alreadyMatched = matches.some(match => 
            (match.user1Id === userId && match.user2Id === profile.userId) ||
            (match.user1Id === profile.userId && match.user2Id === userId)
        );

        return !alreadyLiked && !alreadyMatched;
    });

    // Limit the number of potential matches
    return potentialMatches.slice(0, limit);
}

// Utility functions
function generateId() {
    return Math.random().toString(36).substr(2, 9);
}

// Event listeners and UI functions
document.addEventListener('DOMContentLoaded', () => {
    initializeDB();

    // Navigation
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const pageId = link.getAttribute('data-page');
            showPage(pageId);
        });
    });

    // Login form
    document.getElementById('login-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const username = document.getElementById('login-username').value;
        const password = document.getElementById('login-password').value;
        const user = login(username, password);
        if (user) {
            showPage('browse-page');
        } else {
            alert('Invalid username or password');
        }
    });

    // Register form
    document.getElementById('register-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const username = document.getElementById('register-username').value;
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;
        const confirmPassword = document.getElementById('register-password-confirm').value;

        if (password !== confirmPassword) {
            alert('Passwords do not match');
            return;
        }

        try {
            const user = registerUser(username, email, password);
            if (user) {
                showPage('create-profile-page');
            }
        } catch (error) {
            alert(error.message);
        }
    });

    // Create profile form
    document.getElementById('create-profile-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const userId = getCurrentUser().id;
        const name = document.getElementById('profile-name').value;
        const age = parseInt(document.getElementById('profile-age').value);
        const gender = document.getElementById('profile-gender').value;
        const location = document.getElementById('profile-location').value;
        const bio = document.getElementById('profile-bio').value;
        const interests = document.getElementById('profile-interests').value.split(',').map(i => i.trim());
        const photo = document.getElementById('profile-photo').value;

        const preferences = {
            ageMin: parseInt(document.getElementById('pref-age-min').value),
            ageMax: parseInt(document.getElementById('pref-age-max').value),
            distance: parseInt(document.getElementById('pref-distance').value),
            genderPreferences: [
                document.getElementById('pref-gender-male').checked ? 'male' : null,
                document.getElementById('pref-gender-female').checked ? 'female' : null,
                document.getElementById('pref-gender-non-binary').checked ? 'non-binary' : null,
                document.getElementById('pref-gender-other').checked ? 'other' : null
            ].filter(Boolean)
        };

        try {
            createProfile(userId, name, age, gender, location, bio, interests, [photo], preferences);
            showPage('browse-page');
        } catch (error) {
            alert(error.message);
        }
    });

    // Logout
    document.getElementById('logout-button').addEventListener('click', () => {
        logout();
        showPage('login-page');
    });

    // Show initial page
    showPage('login-page');
});

function showPage(pageId) {
    // Hide all pages
    document.querySelectorAll('[id$="-page"]').forEach(page => {
        page.style.display = 'none';
    });

    // Show the selected page
    document.getElementById(pageId).style.display = 'block';

    // Load data if necessary
    if (pageId === 'browse-page') {
        loadBrowsePage();
    } else if (pageId === 'matches-page') {
        loadMatchesPage();
    } else if (pageId === 'profile-page') {
        loadProfilePage();
    }
}

function loadBrowsePage() {
    const currentUser = getCurrentUser();
    if (!currentUser) {
        showPage('login-page');
        return;
    }

    const potentialMatches = getPotentialMatches(currentUser.id);
    const profileBrowser = document.getElementById('profile-browser');
    profileBrowser.innerHTML = '';

    if (potentialMatches.length === 0) {
        document.getElementById('no-profiles-card').style.display = 'block';
        return;
    }

    potentialMatches.forEach(profile => {
        const card = document.createElement('div');
        card.className = 'profile-card';
        card.style.backgroundImage = `url(${profile.photos[0] || 'default-profile.jpg'})`;
        card.innerHTML = `
            <div class="profile-info">
                <div class="profile-name">${profile.name}, ${profile.age}</div>
                <div class="profile-details">
                    <span>${profile.gender}</span>
                    <span>${profile.location}</span>
                </div>
                <div class="profile-bio">${profile.bio}</div>
                <div class="action-buttons">
                    <div class="action-button dislike" onclick="dislikeProfile('${profile.userId}')">✖</div>
                    <div class="action-button" onclick="likeProfile('${profile.userId}')">❤</div>
                </div>
            </div>
        `;
        profileBrowser.appendChild(card);
    });
}

function loadMatchesPage() {
    const currentUser = getCurrentUser();
    if (!currentUser) {
        showPage('login-page');
        return;
    }

    const matches = getData(DB_KEYS.MATCHES).filter(match => 
        match.user1Id === currentUser.id || match.user2Id === currentUser.id
    );

    const matchesList = document.getElementById('matches-list');
    matchesList.innerHTML = '';

    if (matches.length === 0) {
        document.getElementById('no-matches-message').style.display = 'block';
        return;
    }

    matches.forEach(match => {
        const matchUserId = match.user1Id === currentUser.id ? match.user2Id : match.user1Id;
        const profile = getProfileByUserId(matchUserId);

        const matchItem = document.createElement('div');
        matchItem.className = 'match-item';
        matchItem.innerHTML = `
            <img src="${profile.photos[0] || 'default-profile.jpg'}" class="match-photo">
            <div class="match-info">
                <div class="match-name">${profile.name}</div>
                <div class="match-last-message">Last message...</div>
            </div>
        `;
        matchItem.addEventListener('click', () => showConversation(match.id));
        matchesList.appendChild(matchItem);
    });
}

function loadProfilePage() {
    const currentUser = getCurrentUser();
    if (!currentUser) {
        showPage('login-page');
        return;
    }

    const profile = getProfileByUserId(currentUser.id);
    const profileDetails = document.getElementById('profile-details');
    profileDetails.innerHTML = `
        <div class="form-group">
            <label>Name:</label>
            <div>${profile.name}</div>
        </div>
        <div class="form-group">
            <label>Age:</label>
            <div>${profile.age}</div>
        </div>
        <div class="form-group">
            <label>Gender:</label>
            <div>${profile.gender}</div>
        </div>
        <div class="form-group">
            <label>Location:</label>
            <div>${profile.location}</div>
        </div>
        <div class="form-group">
            <label>Bio:</label>
            <div>${profile.bio}</div>
        </div>
        <div class="form-group">
            <label>Interests:</label>
            <div class="interests-tags">
                ${profile.interests.map(interest => `<span class="interest-tag">${interest}</span>`).join('')}
            </div>
        </div>
    `;
}

function showConversation(matchId) {
    showPage('conversation-page');
    // Load conversation messages
}

function likeProfile(likedId) {
    const currentUser = getCurrentUser();
    if (!currentUser) {
        showPage('login-page');
        return;
    }

    const match = likeProfile(currentUser.id, likedId);
    if (match) {
        showMatchOverlay(likedId);
    }
    loadBrowsePage();
}

function dislikeProfile(likedId) {
    // Implement dislike functionality
    loadBrowsePage();
}

function showMatchOverlay(matchUserId) {
    const profile = getProfileByUserId(matchUserId);
    const matchOverlay = document.getElementById('match-overlay');
    const matchPhotos = document.getElementById('match-photos');
    const matchName = document.getElementById('match-name');

    matchPhotos.innerHTML = `
        <div class="match-photo-container">
            <img src="${getProfileByUserId(getCurrentUser().id).photos[0] || 'default-profile.jpg'}">
        </div>
        <div class="match-photo-container">
            <img src="${profile.photos[0] || 'default-profile.jpg'}">
        </div>
    `;
    matchName.textContent = profile.name;
    matchOverlay.style.display = 'flex';

    document.getElementById('send-message-match').addEventListener('click', () => {
        matchOverlay.style.display = 'none';
        showConversation(matchUserId);
    });

    document.getElementById('keep-browsing').addEventListener('click', () => {
        matchOverlay.style.display = 'none';
        loadBrowsePage();
    });
}