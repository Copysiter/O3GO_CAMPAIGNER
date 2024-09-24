window.initToolbar = function() {
    $('#numbers-toolbar').kendoToolBar({
        items: [
            {
                template: "<div class='k-window-title ps-6'>Registered Numbers</div>",
            },
            {
                type: 'spacer',
            },
            {
                type: 'button',
                text: 'Refresh',
                click: function (e) {
                    $('#numbers-grid').data('kendoGrid').dataSource.read();
                },
            },
            {
                type: 'button',
                text: 'Clear Filter',
                click: function (e) {
                    $('#numbers-grid').data('kendoGrid').dataSource.filter({});
                },
            }
        ],
    });
}