window.initToolbar = function() {
    $('#devices-toolbar').kendoToolBar({
        items: [
            {
                template: "<div class='k-window-title ps-6'>Devices</div>",
            },
            {
                type: 'spacer',
            },
            {
                type: 'button',
                text: 'Refresh',
                click: function (e) {
                    $('#devices-grid').data('kendoGrid').dataSource.read();
                },
            },
            {
                type: 'button',
                text: 'Clear Filter',
                click: function (e) {
                    $('#devices-grid').data('kendoGrid').dataSource.filter({});
                },
            },
            {
                type: 'button',
                text: 'New Device',
                icon: 'plus',
                click: function (e) {
                    let grid = $('#devices-grid').data('kendoGrid');
                    grid.addRow();
                },
            },
        ],
    });
}