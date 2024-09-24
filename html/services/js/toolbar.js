window.initToolbar = function() {
    $('#services-toolbar').kendoToolBar({
        items: [
            {
                template: "<div class='k-window-title ps-6'>Services</div>",
            },
            {
                type: 'spacer',
            },
            {
                type: 'button',
                text: 'Refresh',
                click: function (e) {
                    $('#services-grid').data('kendoGrid').dataSource.read();
                },
            },
            {
                type: 'button',
                text: 'Clear Filter',
                click: function (e) {
                    $('#services-grid').data('kendoGrid').dataSource.filter({});
                },
            },
            {
                type: 'button',
                text: 'New Service',
                icon: 'plus',
                click: function (e) {
                    let grid = $('#services-grid').data('kendoGrid');
                    grid.addRow();
                },
            },
        ],
    });
}