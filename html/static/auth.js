if (window.location.href.includes("o3go")) {
    window.api_base_url = 'https://compainer.o3go.ru'
} else {
    window.api_base_url = `http://${document.location.hostname}:5001`
}

window.getToken = function () {
    return JSON.parse(localStorage.getItem('token'));
};
window.setToken = function (item) {
    if (!item) {
        localStorage.removeItem('token');
        window.isAuth = null;
        return;
    }
    let { access_token, token_type, ts, user } = item;
    localStorage.setItem(
        'token',
        JSON.stringify({
            access_token,
            token_type,
            ts,
            user,
        })
    );
    window.isAuth = window.getToken();
};

window.isAuth = window.getToken('token');
if (!isAuth && document.location.pathname !== '/auth' && document.location.pathname !== '/auth/') {
    document.location.href = document.location.origin + '/auth/';
}

if (isAuth) {
    const user = window.isAuth.user.name;
    const is_superuser = window.isAuth.user.is_superuser;

    if (
        // (!is_superuser && document.location.pathname === '/auth/') ||
        // (!is_superuser && document.location.pathname === '/auth/')
        (document.location.pathname === '/') ||
        (document.location.pathname === '') ||
        (document.location.pathname === '/auth/') ||
        (document.location.pathname === '/auth')
    ) {
        document.location.href = document.location.origin + '/campaigns/';
    }
}

window.redirectToAuth = function () {
    if (document.location.pathname !== '/auth' && document.location.pathname !== '/auth/') {
        document.location.href = document.location.origin + '/auth/';
    }
};

// Test token
window.refreshAuth = function () {
    if (!window.isAuth) {
        window.setToken(null);
        window.redirectToAuth();
        return $.Deferred().resolve(null).promise();
    }

    let { access_token, token_type, user } = window.isAuth;
    return $.ajax({
        type: 'POST',
        url: `${api_base_url}/api/v1/auth/test-token`,
        headers: {
            Authorization: `${token_type} ${access_token}`,
            accept: 'application/json',
        },
    }).then(function (data) {
        if (!data.user || data.user.is_active !== user.is_active) {
            window.setToken(null);
            window.redirectToAuth();
            return null;
        }
        window.setToken({
            access_token,
            token_type,
            ts: data.ts,
            user: data.user,
        });
        window.newDate = new Date(data.ts);
        return window.isAuth;
    }, function () {
        window.setToken(null);
        window.redirectToAuth();
        return null;
    });
};

checkAuth = function () {
    window.refreshAuth().always(function () {
        setTimeout(() => checkAuth(), 60000);
    });
}

window.authReady = window.refreshAuth();
window.authReady.always(function () {
    setTimeout(() => checkAuth(), 60000);
});
/*
setInterval(() => {
    if (isAuth) {
        let { access_token, token_type, ts, user } = isAuth;
        $.ajax({
            type: 'POST',
            url: '/api/v1/auth/test-token',
            headers: {
                Authorization: `${token_type} ${access_token}`,
                accept: 'application/json',
            },
        })
            .done(function (data) {
                let { access_token, token_type } = isAuth;
                let { user, ts } = data;
                if (data.user.is_active !== user.is_active) {
                    window.setToken(null);
                }
                window.setToken({
                    access_token,
                    token_type,
                    ts,
                    user,
                });
                console.log('ts', ts);
                window.newDate = new Date(ts);
            })
            .fail(function (data) {
                if (localStorage.getItem('token')) localStorage.removeItem('token');
                if (document.location.pathname !== '/auth') {
                    document.location.href = document.location.origin + '/auth';
                }
                $('#notification')
                    .getKendoNotification()
                    .show(`Session expired.`);
            });
    }
}, 60000);
*/
