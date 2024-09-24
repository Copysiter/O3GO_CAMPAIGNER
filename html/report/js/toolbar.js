window.initToolbar = function() {
    $('#report-toolbar').kendoToolBar({
        items: [
            {
                template: "<div class='k-window-title ps-6'>Report</div>",
            },
            {
                type: 'spacer',
            },
            {
                template: "<input id='period-ddl' class='datepicker' />",
            },
            { type: "separator" },
            {
                template: "<div id='wrapper-drp'><div id='daterangepicker'></div></div>",
            },
            { type: "separator" },
            {
                type: 'button',
                text: 'Refresh',
                click: function (e) {
                    $('#report-grid').data('kendoGrid').dataSource.read();
                },
            },
            {
                type: 'button',
                text: 'Clear Filter',
                click: function (e) {
                    $('#report-grid').data('kendoGrid').dataSource.filter({});
                },
            },
        ],
    });

    $("#period-ddl").kendoDropDownList({
        dataSource: [{"value": "0d", "text": "Current Day"},
                     {"value": "1d", "text": "Yesterday"},
                     {"value": "3d", "text": "Last 3 Days"},
                     {"value": "7d", "text": "Last 7 Days"},
                     {"value": "30d", "text": "Last 30 Days"}],
        optionLabel: "Select Period",
        dataTextField: 'text',
        dataValueField: 'value',
        valuePrimitive: true,
        downArrow: true,
        animation: false,
        autoClose: true,
        value: "0d",
        select: function (e) {
            window.selectedPeriod = e.dataItem;
            /*
            let chart = $("#chart").data("kendoChart");
            chart.setOptions({
                title: {
                    text: `Selected Period: ${window.selectedPeriod ? window.selectedPeriod : "None"}, Selected Name: ${window.row_name}`,
                },
            });
            chart.refresh();
            */
            if (!e.dataItem.value.length) {
                let daterangepicker = $("#daterangepicker").data("kendoDateRangePicker");
                daterangepicker.enable(true);
            } else {
                daterangepicker.enable(false);
                $("#report-grid").data("kendoGrid").clearSelection();
                $("#report-grid").data("kendoGrid").dataSource.filter({
                    field: 'period',
                    operator: 'eq',
                    value: e.dataItem.value,
                });
            }
        },
    });
    $("#daterangepicker").kendoDateRangePicker({
        format: "yyyy-MM-dd",
        labels: false,
        startField: "startField",
        enable: false,
        change: function () {
            let range = this.range();
            if (range.start && range.end) {
                let begin_dt = kendo.parseDate(range.start, "yyyy-MM-dd h:mm:ss tt");
                let end_dt = kendo.parseDate(range.end, "yyyy-MM-dd h:mm:ss tt");
                let begin = kendo.toString(begin_dt, "yyyy-MM-dd 00:00:00");
                let end = kendo.toString(end_dt, "yyyy-MM-dd 23:59:59");
                $("#report-grid").data("kendoGrid").dataSource.filter([{
                    field: 'date',
                    operator: 'gte',
                    value: begin,
                }, {
                    field: 'date',
                    operator: 'lte',
                    value: end,
                }]);
            }
        }
    });
    let daterangepicker = $("#daterangepicker").data("kendoDateRangePicker");
    daterangepicker.enable(false);
    let rangePicker = document.getElementById("daterangepicker");
    rangePicker.children[1].innerHTML = "&mdash;";
    rangePicker.children[1].style.marginTop = "5px";
}
