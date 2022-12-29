$(document).ready(function () {
    // $('.red-ui-header-toolbar').prepend('<li><button id="btnLabSettings" class="kyuda-button kyuda-button--primary">Settings</button></li>');
    $('.red-ui-header-toolbar').prepend('<li><button id="btnLabResources" class="kyuda-button kyuda-button--primary">Kyuda</button></li>');
    $('.red-ui-header-toolbar').prepend('<li><button id="btnLabDocumentation" class="kyuda-button kyuda-button--primary">Docs</button></li>');
    // $(document).on('click','#btnLabSettings',function(){
    //     window.open('/plugin/settings', '_blank');
    // });
    $(document).on('click','#btnLabResources',function(){
        window.open('https://app.kyuda.io', '_blank');
    });
    $(document).on('click','#btnLabDocumentation',function(){
        window.open('https://docs.kyuda.io/flow/introduction', '_blank');
    });
});