"""Generate the API contract using only the Python standard library."""
import json, pathlib
string={'type':'string'}
def obj(properties,required=()): return {'type':'object','properties':{k:({'type':'string'} if v is None else v) for k,v in properties.items()},'required':list(required)}
def enum(*values):return {'type':'string','enum':values}
member=obj({k:None for k in ['firstName','lastName','middleName','phone','position','department','joinDate','avatar'] }|{'status':enum('ACTIVE','INACTIVE')},['firstName','lastName','position','department','joinDate','avatar'])
news=obj({k:None for k in ['title','slug','shortDescription','content','image']}|{'status':enum('DRAFT','PUBLISHED'),'notify':{'type':'boolean'}},['title','slug','shortDescription','content'])
document=obj({'title':None,'description':None,'category':enum('RULES','RESOLUTIONS','MINUTES','ORDERS','REPORTS','REGULATIONS','OTHER'),'fileId':None},['title','category','fileId'])
event=obj({k:None for k in ['title','description','date','startTime','endTime','location','image','organizer']}|{'status':enum('UPCOMING','PAST','CANCELLED')},['title','date','startTime','endTime','location','organizer'])
application=obj({'type':enum('MATERIAL','ONE_TIME','SOCIAL','OTHER'),'title':None,'description':None,'amount':{'type':['number','null'],'minimum':0,'maximum':100000000},'fileIds':{'type':'array','maxItems':10,'items':string}},['type','title','description'])
response={'type':'object','required':['success','message'],'properties':{'success':{'type':'boolean'},'message':string,'data':{},'errors':{'type':'array','items':{}}}}
spec={'openapi':'3.1.0','info':{'title':'КӘСІПОДАҚ API','version':'1.0.0','description':'PHP sessions, CSRF and SQLite. REST paths require Apache rewrite or the supplied router. Alternative: api.php?path=resource/id.'},'servers':[{'url':'./'}],'paths':{},'components':{'securitySchemes':{'session':{'type':'apiKey','in':'cookie','name':'kasipodaq_session'}},'schemas':{'Response':response}}}
def operation(path,method,summary,body=None,private=False,params=()):
    p=[]
    for name in ['id','slug']:
        if '{'+name+'}' in path:p.append({'name':name,'in':'path','required':True,'schema':string})
    if method!='get':p.append({'name':'X-CSRF-Token','in':'header','required':True,'schema':string,'description':'Token from GET meta, refreshed on login/logout'})
    for name in params:p.append({'name':name,'in':'query','schema':{'type':'integer','minimum':1,'maximum':100 if name=='pageSize' else 100000} if name in ['page','pageSize'] else string})
    op={'summary':summary,'operationId':method+'_'+path.replace('/','_').replace('{','').replace('}',''),'parameters':p,'security':[{'session':[]} ] if private else [],'responses':{str(code):{'description':desc,'content':{'application/json':{'schema':{'$ref':'#/components/schemas/Response'}}}} for code,desc in [(200,'Success'),(201,'Created'),(400,'Validation error'),(401,'Authentication required'),(403,'Permission or CSRF denied'),(404,'Not found'),(409,'Conflict'),(429,'Rate limited'),(500,'Server error')]}}
    if body:op['requestBody']={'required':True,'content':{'application/json':{'schema':body}}}
    spec['paths'].setdefault('/api/'+path,{})[method]=op
operation('meta','get','Public metadata, CSRF, current session and installation status')
operation('overview','get','Public aggregate counts')
operation('setup','post','One-time installation; rejected after first user exists',obj({k:None for k in ['email','password','firstName','lastName']}|{'demo':{'type':'boolean'}},['email','password','firstName','lastName']))
operation('auth/login','post','Login with email/password',obj({'email':{'type':'string','format':'email'},'password':string},['email','password']))
operation('auth/logout','post','Log out current session',private=True)
operation('auth/me','get','Current user with own member profile',private=True)
operation('auth/profile','put','Update own name, phone and avatar',obj({k:None for k in ['firstName','lastName','middleName','phone','avatar']},['firstName','lastName']),True)
operation('auth/password','put','Change password; invalidate other sessions',obj({'currentPassword':string,'password':{'type':'string','minLength':8,'maxLength':72}},['currentPassword','password']),True)
operation('uploads','post','Authenticated upload: PDF/DOC/DOCX/XLS/XLSX/JPG/PNG, max 10 MB',private=True)
spec['paths']['/api/uploads']['post']['requestBody']={'required':True,'content':{'multipart/form-data':{'schema':obj({'file':{'type':'string','format':'binary'}},['file'])}}}
operation('files/{id}','get','Download public document/image or authorized private file',params=['download'])
spec['paths']['/api/files/{id}']['get']['responses']['200']={'description':'Binary file','content':{'application/octet-stream':{'schema':{'type':'string','format':'binary'}}}}
for resource,schema in [('members',member),('news',news),('documents',document),('events',event),('applications',application),('users',obj({'email':string,'role':enum('ADMIN','CHAIRMAN','MEMBER'),'isActive':{'type':'boolean'},'password':string},['email','role']))]:
    private=resource in ['members','applications','users']
    params=['page','pageSize']+(['q'] if resource in ['members','news','documents','events'] else [])+{'members':['department','position','status'],'applications':['status','type'],'news':['status'],'documents':['category'],'events':['status'],'users':[]}[resource]
    operation(resource,'get','List '+resource+' with pagination and role/ownership checks',private=private,params=params)
    detailKey='slug' if resource=='news' else 'id'
    operation(resource+'/{'+detailKey+'}','get','Read '+resource+' detail',private=private)
    if resource!='users':
        create=schema
        if resource=='members':create=json.loads(json.dumps(member));create['properties'].update({'email':string,'password':string,'role':enum('ADMIN','CHAIRMAN','MEMBER')});create['required']+=['email','password']
        operation(resource,'post','Create '+resource+'; server checks module role',create,True)
    update=obj({'title':string,'description':string},['title','description']) if resource=='applications' else schema
    operation(resource+'/{id}','put','Update '+resource+'; server checks role/ownership',update,True)
    operation(resource+'/{id}','delete','Delete '+resource+'; relationships and administrator safety enforced',private=True)
operation('members/options','get','Department and position filter values; staff',private=True)
operation('applications/{id}/comments','post','Add comment/reply to accessible application',obj({'text':string},['text']),True)
operation('applications/{id}/attachments','post','Attach own uploaded file',obj({'fileId':string},['fileId']),True)
operation('applications/{id}/status','post','Staff changes status; history and notification saved',obj({'status':enum('NEW','IN_REVIEW','NEEDS_INFO','APPROVED','REJECTED','COMPLETED')},['status']),True)
operation('events/{id}/join','post','Join upcoming event once',private=True)
operation('events/{id}/join','delete','Cancel own participation',private=True)
operation('statistics','get','Staff statistics; counts are overall, charts use days',private=True,params=['days'])
operation('notifications','get','Own notifications and unread count',private=True)
operation('notifications/{id}/read','put','Mark own notification read',private=True)
operation('notifications/all/read','put','Mark all own notifications read',private=True)
operation('settings','get','Public school information')
operation('settings','put','ADMIN updates school information',obj({k:None for k in ['schoolName','address','phone','email','importantInfo']}),True)
path=pathlib.Path(__file__).resolve().parent.parent/'public/openapi.json'
path.write_text(json.dumps(spec,ensure_ascii=False,indent=2)+'\n')
print(f'OpenAPI: {sum(len(v) for v in spec["paths"].values())} operations')
