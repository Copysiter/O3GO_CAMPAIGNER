$(document).ready(function () {
    // window.storageToken = new kendo.data.DataSource({
    //     offlineStorage: {
    //         getItem: function () {
    //             return JSON.parse(sessionStorage.getItem('token'));
    //         },
    //         setItem: function (item) {
    //             sessionStorage.setItem('token', JSON.stringify(item));
    //         },
    //     },
    // });
    const drawerRootTemplate = `<ul>
    <li>
    <a href='/campaigns/' data-role='drawer-item' class='${
        $('body').attr('data-id') == 'campaigns' ? 'k-selected ' : ''
    }d-flex align-items-center text-decoration-none p-0' id='reports-icon'>
    <span><i class='mdi mdi-cube fs-24'></i></span>
    <span class='k-item-text flex-grow-1 fs-14 ps-0 pe-20 pt-2' data-id='campaigns'>Campaigns</span>
    </a>
    </li>
    <li>
    <a href='/tags/' data-role='drawer-item' class='${
        $('body').attr('data-id') == 'tags' ? 'k-selected ' : ''
    }d-flex align-items-center text-decoration-none p-0' id='peers-icon'>
    <span><i class='mdi mdi-tag-multiple fs-24'></i></span>
    <span class='k-item-text flex-grow-1 fs-14 ps-0 pe-20 pt-2' data-id='Tags'>Tags</span>
    </a> 
    </li>
    <li>
    <a href='/users/' data-role='drawer-item' class='${
        $('body').attr('data-id') == 'users' ? 'k-selected ' : ''
    }d-flex align-items-center text-decoration-none p-0' id='reports-icon'>
    <span><i class='mdi mdi-account-supervisor fs-24'></i></span>
    <span class='k-item-text flex-grow-1 fs-14 ps-0 pe-20 pt-2' data-id='users'>Users</span>
    </a>
    </li>
    </ul>`;

    const drawerUserTemplate = `<ul>
    <li>
    <a href='/campaigns/' data-role='drawer-item' class='${
        $('body').attr('data-id') == 'campaigns' ? 'k-selected ' : ''
    }d-flex align-items-center text-decoration-none p-0' id='reports-icon'>
    <span><i class='mdi mdi-cube fs-24'></i></span>
    <span class='k-item-text flex-grow-1 fs-14 ps-0 pe-20 pt-2' data-id='campaigns'>Campaigns</span>
    </a>
    </li>
    </ul>`;

    if (window.isAuth) {
        const isAuth = window.getToken();
        window.newDate = new Date(isAuth.ts);
        runTime = function () {
            let timer = document.getElementById('timer');
            newDate.setSeconds(newDate.getSeconds() + 1);
            let h = String(newDate.getHours()).length !== 1 ? newDate.getHours() : `0${newDate.getHours()}`;
            let m = String(newDate.getMinutes()).length !== 1 ? newDate.getMinutes() : `0${newDate.getMinutes()}`;
            let s = String(newDate.getSeconds()).length !== 1 ? newDate.getSeconds() : `0${newDate.getSeconds()}`;
            timer.innerText = h + ':' + m + ':' + s + ' UTC';
            // timer.innerText = kendo.toString(newDate.setSeconds(newDate.getSeconds() + 1), 'HH:mm:ss UTC');
            setTimeout(runTime, 1000);
        };

        toggleDrawer = function () {
            if (drawer.visible) {
                drawer.hide();
                drawer.trigger('hide');
            } else {
                drawer.show();
                drawer.trigger('show');
            }
        };
        const user = window.isAuth.user.name;
        const is_superuser = window.isAuth.user.is_superuser;
        var shouldPrevent = false;
        let drawer = $('#drawer')
            .kendoDrawer({
                mode: 'push',
                //mode: "overlay",
                mini: {
                    width: 51,
                },
                width: 200,
                position: 'left',
                swipeToOpen: false,
                //template: user === 'Root' ? drawerRootTemplate : drawerUserTemplate,
                template: is_superuser ? drawerRootTemplate : drawerUserTemplate,
                itemClick: function(e) {            
                    shouldPrevent = true;
                },
                show: function (e) {
                    $('#drawer-toggle i').removeClass('mdi-forwardburger');
                    $('#drawer-toggle i').addClass('mdi-backburger');
                },
                hide: function (e) {
                    if (shouldPrevent) {
                        shouldPrevent = false;
                        e.preventDefault();
                    }
                    $('#drawer-toggle i').removeClass('mdi-backburger');
                    $('#drawer-toggle i').addClass('mdi-forwardburger');
                },
                // itemClick: function (e) {
                //     if (!e.item.hasClass("k-drawer-separator")) {
                //         e.sender.drawerContainer.find("#drawer-content > div").addClass("hidden");
                //         e.sender.drawerContainer
                //             .find("#drawer-content")
                //             .find("#" + e.item.find(".k-item-text").attr("data-id"))
                //             .removeClass("hidden");
                //     }
                // },
            })
            .data('kendoDrawer');

        $('#appbar').kendoToolBar({
            items: [
                {
                    template: '<span id="drawer-toggle" onclick="toggleDrawer()"><i class="mdi mdi-forwardburger"></i></span>',
                    overflow: 'never',
                },
                {
                    template: '<div id="logo"><img src="../static/images/logo.svg" height=14 /></div>',
                    overflow: 'never',
                },
                { type: 'spacer' },
                {
                    template: `<div id="auth" class="d-flex align-items-center pe-12"><i class="mdi mdi-account-circle fs-20 text-white-50"></i><div class="ms-6 text-nowrap">${window.isAuth.user.name}</div></div>`,
                    overflow: 'never',
                },
                {
                    template:
                        '<div id="time" class="d-flex align-items-center my-n8 ps-12"><i class="mdi mdi-clock d-block fs-20 text-success"></i><div id="timer" class="ms-6 fs-16 text-nowrap"></div></div>',
                    overflow: 'never',
                },
                {
                    template: `<a id="logout" class="" href="#" onclick="logout()"><i class="mdi mdi-power"></i></a>`,
                    overflow: 'never',
                },
            ],
        });

        runTime(newDate);
    }
});

function logout() {
    $('#confirm-logout')
        .kendoConfirm({
            content: 'Do you really want to log out?',
            messages: {
                okText: 'Logout',
            },
        })
        .data('kendoConfirm')
        .result.done(function () {
            localStorage.removeItem('token');
            document.location.href = document.location.origin + '/auth/';
        })
        .fail(function () {
            return;
        });
}

// optimize custom grids

window.optimize_grid = function (grids) {
    console.log(grids);
    $.each(grids, function (index, grid) {
        if ($(`${grid} .k-grid-footer`).length > 0) {
            $(`${grid} .k-grid-content table`).append('<tfoot></tfoot>');
            $(`${grid} .k-grid-content table tfoot`).html($(`${grid} .k-grid-footer tbody`).html());
            $(`${grid} .k-grid-footer`).remove();
            $(`${grid} .k-grid-content tfoot`).addClass('k-grid-footer');
        }
        $(`${grid} .k-grid-content table`).prepend($(`${grid} .k-grid-header thead`));
        $(`${grid} .k-grid-header`).remove();
        $(`${grid} colgroup`).remove();
        $(`${grid} .k-grid-content thead`).addClass('k-grid-header');
    });
};
