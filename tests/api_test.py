"""Integration tests against a fresh PHP server/database. Python 3 standard library."""
import os, json, urllib.request, urllib.error, http.cookiejar, unittest, uuid
BASE=os.environ.get('TEST_URL','http://127.0.0.1:4080/')
class Client:
    def __init__(self):
        self.http=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
        self.csrf=self.req('meta')[1]['data']['csrf']
    def req(self,path,method='GET',body=None,csrf=True,raw=None,ctype=None):
        headers={}
        if method!='GET' and csrf: headers['X-CSRF-Token']=self.csrf
        if raw is not None:data=raw;headers['Content-Type']=ctype
        elif method!='GET':data=json.dumps(body or {}).encode();headers['Content-Type']='application/json'
        else:data=None
        route,*query=path.split('?',1)
        request=urllib.request.Request(BASE+'api.php?path='+route+('&'+query[0] if query else ''),data=data,headers=headers,method=method)
        try:r=self.http.open(request)
        except urllib.error.HTTPError as e:r=e
        content=r.read()
        try:result=json.loads(content)
        except ValueError:result=content
        return r.code,result
    def login(self,email,password='Dev@12345!'):
        code,res=self.req('auth/login','POST',{'email':email,'password':password})
        if code==200:self.csrf=res['data']['csrf'];self.user=res['data']['user']
        return code,res
    def upload(self,name,content):
        boundary='----'+uuid.uuid4().hex
        raw=(f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{name}"\r\nContent-Type: application/octet-stream\r\n\r\n').encode()+content+f'\r\n--{boundary}--\r\n'.encode()
        return self.req('uploads','POST',raw=raw,ctype='multipart/form-data; boundary='+boundary)
class API(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.admin=Client();meta=cls.admin.req('meta')[1]['data']
        if not meta['installed']:
            code,res=cls.admin.req('setup','POST',{'email':'admin@example.com','password':'Dev@12345!','firstName':'Әкімші','lastName':'Мектеп','demo':True})
            assert code==201,res
        assert cls.admin.login('admin@example.com')[0]==200
        cls.member=Client();assert cls.member.login('member@example.com')[0]==200
        cls.chair=Client();assert cls.chair.login('chairman@example.com')[0]==200
        cls.guest=Client()
    def test_01_seed_counts(self):
        data=self.admin.req('statistics')[1]['data']['counts']
        self.assertEqual(data['members'],16);self.assertEqual(data['applications'],10);self.assertEqual(data['news'],5)
    def test_02_wrong_password(self):self.assertEqual(Client().login('admin@example.com','incorrect')[0],401)
    def test_03_password_private(self):
        user=self.admin.req('auth/me')[1]['data'];self.assertNotIn('password',user);self.assertNotIn('version',user)
    def test_04_csrf(self):self.assertEqual(self.admin.req('settings','PUT',{},csrf=False)[0],403)
    def test_05_member_permissions(self):
        for resource in ['members','users','statistics']:self.assertEqual(self.member.req(resource)[0],403)
    def test_06_guest_permissions(self):self.assertEqual(self.guest.req('applications')[0],401)
    def test_07_member_creation(self):
        b={'email':'new@example.com','password':'Strong123!','firstName':'Әсел','lastName':'Жаңабаева','phone':'+7 700 000 00 00','position':'Мұғалім','department':'Қазақ тілі','joinDate':'2026-10-06','status':'ACTIVE'}
        code,r=self.admin.req('members','POST',b);self.assertEqual(code,201,r);id=r['data']['id']
        b['firstName']='Айдана';self.assertEqual(self.admin.req('members/'+id,'PUT',b)[0],200)
        self.assertEqual(self.admin.req('members/'+id,'DELETE')[0],200)
    def test_08_chair_cannot_create_member(self):self.assertEqual(self.chair.req('members','POST',{})[0],403)
    def test_09_member_application(self):
        code,res=self.member.req('applications','POST',{'type':'MATERIAL','title':'Тест өтініші','description':'Материалдық көмек сұраймын, қажет құжаттарды ұсынамын.','amount':15000})
        self.assertEqual(code,201,res);id=res['data']['id'];self.assertEqual(res['data']['amount'],15000)
        self.assertEqual(self.chair.req('applications/'+id+'/status','POST',{'status':'IN_REVIEW'})[0],200)
        self.assertEqual(self.member.req('applications/'+id+'/status','POST',{'status':'APPROVED'})[0],403)
        self.assertEqual(self.admin.req('applications/'+id+'/comments','POST',{'text':'Қарауға қабылданды'})[0],200)
        detail=self.member.req('applications/'+id)[1]['data'];self.assertEqual(len(detail['history']),2);self.assertEqual(len(detail['comments']),1)
        self.assertEqual(self.member.req('applications/'+id,'DELETE')[0],403)
        self.assertEqual(self.admin.req('applications/'+id,'DELETE')[0],200)
    def test_10_application_ownership(self):
        all=self.admin.req('applications?pageSize=100')[1]['data']['items'];other=next(x for x in all if x['member']['userId']!=self.member.user['id'])
        self.assertEqual(self.member.req('applications/'+other['id'])[0],403)
    def test_11_validation(self):
        self.assertEqual(self.member.req('applications','POST',{'title':'x','type':'WRONG'})[0],400)
        self.assertEqual(self.admin.req('members?page=0')[0],400)
    def test_12_news_crud_and_draft(self):
        b={'title':'Жаңа тест жаңалығы','slug':'test-news-'+uuid.uuid4().hex,'shortDescription':'Кәсіподақ жаңалығы','content':'Ұжыммен бірге жаңа бастаманы талқыладық.','status':'DRAFT','image':''}
        code,res=self.chair.req('news','POST',b);self.assertEqual(code,201,res);id=res['data']['id']
        self.assertEqual(self.guest.req('news/'+b['slug'])[0],404)
        b['status']='PUBLISHED';self.assertEqual(self.chair.req('news/'+id,'PUT',b)[0],200)
        self.assertEqual(self.guest.req('news/'+b['slug'])[0],200)
        self.assertEqual(self.member.req('news/'+id,'DELETE')[0],403)
        self.assertEqual(self.chair.req('news/'+id,'DELETE')[0],200)
    def test_13_document_upload_crud(self):
        with open(os.path.join(os.path.dirname(__file__),'../seed-documents/seed-document-1.pdf'),'rb') as f:pdf=f.read()
        code,r=self.admin.upload('test.pdf',pdf);self.assertEqual(code,201,r);fid=r['data']['id']
        self.assertEqual(self.guest.req('files/'+fid)[0],401)
        b={'title':'Тест құжаты','description':'Ереже','category':'RULES','fileId':fid}
        code,r=self.admin.req('documents','POST',b);self.assertEqual(code,201,r);id=r['data']['id'];self.assertNotEqual(id,fid)
        self.assertEqual(self.guest.req('files/'+fid)[0],200)
        b['title']='Өңделген құжат';self.assertEqual(self.admin.req('documents/'+id,'PUT',b)[0],200)
        self.assertEqual(self.chair.req('documents/'+id,'DELETE')[0],403)
        self.assertEqual(self.admin.req('documents/'+id,'DELETE')[0],200)
    def test_14_upload_rejects_script(self):self.assertEqual(self.member.upload('attack.php',b'<?php echo "bad";')[0],400)
    def test_15_upload_rejects_fake_pdf(self):self.assertEqual(self.member.upload('fake.pdf',b'not a pdf')[0],400)
    def test_16_event_crud_participation(self):
        b={'title':'Тест іс-шарасы','description':'Ұжымдық кездесу','date':'2099-01-01','startTime':'15:00','endTime':'17:00','location':'Мектеп','organizer':'Кәсіподақ','status':'UPCOMING','image':''}
        code,r=self.chair.req('events','POST',b);self.assertEqual(code,201,r);id=r['data']['id']
        self.assertEqual(self.member.req('events/'+id+'/join','POST')[0],200)
        self.assertEqual(self.member.req('events/'+id+'/join','POST')[0],200)
        self.assertEqual(self.member.req('events/'+id)[1]['data']['participants'],1)
        self.assertEqual(self.member.req('events/'+id+'/join','DELETE')[0],200)
        b['title']='Өңделген іс-шара';self.assertEqual(self.chair.req('events/'+id,'PUT',b)[0],200)
        self.assertEqual(self.chair.req('events/'+id,'DELETE')[0],200)
    def test_17_notifications(self):
        data=self.member.req('notifications')[1]['data'];self.assertGreater(len(data['items']),0)
        self.assertEqual(self.member.req('notifications/all/read','PUT')[0],200)
        self.assertEqual(self.member.req('notifications')[1]['data']['unread'],0)
    def test_18_admin_protection(self):
        self.assertEqual(self.admin.req('users/'+self.admin.user['id'],'DELETE')[0],409)
        self.assertEqual(self.admin.req('users/'+self.admin.user['id'],'PUT',{'email':'admin@example.com','role':'MEMBER','isActive':True})[0],409)
    def test_19_settings_roles(self):
        self.assertEqual(self.chair.req('settings','PUT',{'schoolName':'wrong'})[0],403)
        self.assertEqual(self.admin.req('settings','PUT',{'schoolName':'№25 жалпы білім беретін мектеп'})[0],200)
    def test_20_sql_injection_search(self):
        code,r=self.admin.req('members?q=%27%20OR%201%3D1--');self.assertEqual(code,200);self.assertEqual(r['data']['total'],0)
    def test_21_search_kazakh(self):self.assertEqual(self.admin.req('members?q=%D3%99%D0%B1%D1%96%D0%BB')[1]['data']['total'],1)
    def test_22_statistics_filter(self):
        for d in [7,30,90,180,365]:self.assertEqual(self.chair.req('statistics?days='+str(d))[0],200)
        self.assertEqual(self.chair.req('statistics?days=2')[0],400)
    def test_23_installer_locked(self):self.assertEqual(self.guest.req('setup','POST',{})[0],409)
    def test_24_logout(self):
        c=Client();self.assertEqual(c.login('member@example.com')[0],200);code,r=c.req('auth/logout','POST');self.assertEqual(code,200);self.assertEqual(c.req('auth/me')[0],401)
    def test_25_profile_validation(self):self.assertEqual(self.member.req('auth/profile','PUT',{'firstName':''})[0],400)
    def test_26_password(self):
        c=Client();c.login('member3@example.com');self.assertEqual(c.req('auth/password','PUT',{'currentPassword':'wrong','password':'Updated123!'})[0],400)
        self.assertEqual(c.req('auth/password','PUT',{'currentPassword':'Dev@12345!','password':'Updated123!'})[0],200)
        self.assertEqual(Client().login('member3@example.com','Updated123!')[0],200)
        c.req('auth/password','PUT',{'currentPassword':'Updated123!','password':'Dev@12345!'})
    def test_27_public_lists(self):
        for r in ['news','events','documents','overview']:self.assertEqual(self.guest.req(r)[0],200)
    def test_28_unknown_route(self):self.assertEqual(self.guest.req('unknown')[0],404)
    def test_29_news_slug_validation(self):self.assertEqual(self.admin.req('news','POST',{'title':'Тақырып','slug':'../../file','shortDescription':'Сипаттама','content':'Толық сипаттама'})[0],400)
    def test_30_event_time_validation(self):self.assertEqual(self.admin.req('events','POST',{'title':'Іс-шара','date':'2026-10-06','startTime':'17:00','endTime':'15:00','location':'Мектеп','organizer':'Кәсіподақ'})[0],400)
    def test_31_role_revokes_session(self):
        b={'email':'role-test@example.com','password':'Strong123!','firstName':'Рөл','lastName':'Тест','position':'Мұғалім','department':'Әкімшілік','joinDate':'2026-10-06'}
        code,r=self.admin.req('members','POST',b);self.assertEqual(code,201,r);m=r['data'];c=Client();self.assertEqual(c.login(b['email'],b['password'])[0],200)
        self.assertEqual(self.admin.req('users/'+m['userId'],'PUT',{'email':b['email'],'role':'CHAIRMAN','isActive':True})[0],200)
        self.assertEqual(c.req('auth/me')[0],401);self.assertEqual(c.login(b['email'],b['password'])[0],200)
        self.assertEqual(c.req('statistics')[0],200);self.assertEqual(self.admin.req('members/'+m['id'],'DELETE')[0],200)
    def test_32_private_file(self):
        with open(os.path.join(os.path.dirname(__file__),'../seed-documents/seed-document-1.pdf'),'rb') as f:pdf=f.read()
        code,r=self.member.upload('private.pdf',pdf);self.assertEqual(code,201);fid=r['data']['id']
        other=Client();other.login('member3@example.com')
        self.assertEqual(self.member.req('files/'+fid)[0],200);self.assertEqual(other.req('files/'+fid)[0],403);self.assertEqual(self.guest.req('files/'+fid)[0],401)
    def test_33_upload_size(self):self.assertIn(self.member.upload('huge.pdf',b'%PDF-1.4\n'+b'a'*(10*1024*1024)+b'\n%%EOF')[0],[400,413])
    def test_34_invalid_image(self):
        self.assertEqual(self.admin.req('events','POST',{'title':'Іс-шара','date':'2099-01-01','startTime':'15:00','endTime':'17:00','location':'Мектеп','organizer':'Кәсіподақ','image':{'bad':True}})[0],400)
if __name__=='__main__':unittest.main(verbosity=2)
