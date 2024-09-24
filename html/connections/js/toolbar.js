window.initToolbar = function() {
    $('#connections-toolbar').kendoToolBar({
        items: [
            {
                template: "<div class='k-window-title ps-6'>Connections</div>",
            },
            {
                type: 'spacer',
            },
            {
                type: 'button',
                text: 'Refresh',
                click: function (e) {
                    $('#connections-grid').data('kendoGrid').dataSource.read();
                },
            },
            {
                type: 'button',
                text: 'Clear Filter',
                click: function (e) {
                    $('#connections-grid')
                        .data('kendoGrid')
                        .dataSource.filter({});
                },
            },
            {
                type: 'button',
                text: 'New Connection',
                icon: 'plus',
                click: function (e) {
                    let grid = $('#connections-grid').data('kendoGrid');
                    grid.addRow();
                },
            },
        ],
    });
}