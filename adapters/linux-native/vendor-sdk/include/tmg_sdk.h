/****************************************************************************
CopyRight (c) Tencent Technology(ShenZhen) Co., Ltd
TMGSDK Header
*****************************************************************************/
#pragma once

#include "av_error.h"
#include "auth_buffer.h"
#include "av_type.h"

class ITMGRoom;
class ITMGAudioCtrl;
class ITMGAudioEffectCtrl;
class ITMGPTT;
class ITMGContext;
class ITMGDelegate;
class ITMGRoomManager;
class ITMGFaceTracker;
class ITMGFaceRenderer;
class ITMGPoseTracker;

//If Compiler shows that GMESDK_VERSION_xxx is not found, it means not all files are upgraded during the sdk upgrade. In this case, please upgrade the SDK in full
static const char* TMG_SDK_VERSION = GMESDK_VERSION_2_9_15_6fa587cb;
QAVSDK_API ITMGContext* QAVSDK_CALL ITMGContextGetInstanceInner(const char* version);
//////////////////////////////////////////////////////////////////////////
// Interface definition section
//////////////////////////////////////////////////////////////////////////
__UNUSED static ITMGContext* ITMGContextGetInstance(){
	return ITMGContextGetInstanceInner(TMG_SDK_VERSION);
}

class ITMGContext {
protected:
    virtual ~ITMGContext() {}

public:
	//////////////////////////////////////////////////////////////////////////
	// basic API

	// Trigger OnEvent in the thread needed
	// should be called in a timer or in some render Update Event, or SDK won't work
	virtual void Poll()= 0;
	// Totally Pause SDK, including releasing Physical Devices Occupation
	virtual int Pause() = 0;
	// Return Back to the Status before Pause() if it can
	virtual int Resume() = 0;

    //Set the Log level
	//		[in]levelWrite -> the level of log writen to logfile, default TMG_LOG_LEVEL_INFO
	//		[in]levelPrint -> the level of log printed to console, default TMG_LOG_LEVEL_ERROR
	virtual int SetLogLevel( ITMG_LOG_LEVEL levelWrite, ITMG_LOG_LEVEL levelPrint) = 0;

	// Set a folder path to locate logs
	virtual int SetLogPath(const char* logDir) = 0;

	// Get the folder path where logs locate
	virtual const char* GetLogPath() = 0;

	// Set TMG callback(must be set up first)
	//		[in]delegate --> TMGSDK callback you can search in ITMGDelegate
	virtual void SetTMGDelegate(ITMGDelegate* delegate) = 0;

	// Get the SDK version
	virtual const char* GetSDKVersion()=0;

	// Optional, Give Application informations, just for backstage statistics, etc.
	virtual void SetAppVersion(const char* appVersion) = 0;

	// Set SDK working region
    virtual void SetRegion(const char* region) = 0;
    virtual void SetHost(const char* chatHost, const char* PTTHost) = 0;

	// Init SDK with relevant informations
	// sdkAppId Application's ID
	// openId EndUsers's openId, it should be an INT64 and not equals to "0".
	virtual int Init(const char* sdkAppId, const char* openId) = 0;

	// Uninit SDK, Release all resources, should be openId is about to change or Application is about to exit
	virtual int Uninit() = 0;

	//////////////////////////////////////////////////////////////////////////
	// RealTime API

	// Enter a room for communication
	// [in]roomID	-->	Indicating a communication
	// [in]roomType	-->	Special the quality of the room
	// [in]authBuff	-->	Authentication code in Tencent Cloud,
    // [in]buffLen		-->	String length of Authentication cod
    /// if return value is AV_OK then means the enter event post success，
    /// then u can wait the ITMG_MAIN_EVENT_TYPE_ENTER_ROOM event.
	virtual int EnterRoom(const char* roomID, ITMG_ROOM_TYPE roomType, const char* authBuff, int buffLen) = 0;


	/// Exit the room
	/// It's ansy-method more info refer to ITMGRoomDelegate
	/// if return value is AV_OK then means the exit event post success，
	/// then u can wait the ITMG_MAIN_EVENT_TYPE_EXIT_ROOM event.
	virtual int ExitRoom() = 0;

	// Check if the user enter the room or not
	virtual bool IsRoomEntered() = 0;

	// Get a room API instance, only available when in room
	virtual ITMGRoom* GetRoom() = 0;

	virtual ITMGRoomManager* GetRoomManager() = 0;

	// Get a AudioCtrl API instance, only available when in room
	virtual ITMGAudioCtrl* GetAudioCtrl() = 0;

	// Get a AudioEffectCtrl API instance, only available when in room
	virtual ITMGAudioEffectCtrl* GetAudioEffectCtrl() = 0;

	//////////////////////////////////////////////////////////////////////////
	// Recording API
	//Get a PttCtrl API instance
	virtual ITMGPTT* GetPTT() = 0;

	//////////////////////////////////////////////////////////////////////////
	// Advanced API, don't use unless you know what would happen

	//// warning : never call this API for any reason, it's only for internal use

	virtual int SetRecvMixStreamCount(int nCount) = 0;

    // these two APIs are associated to Range Audio
    virtual int SetRangeAudioMode(ITMG_RANGE_AUDIO_MODE gameAudioMode) = 0;
    virtual int SetRangeAudioTeamID(int teamID) = 0;
    virtual int SetAudioRole(ITMG_AUDIO_MEMBER_ROLE role) = 0;

	virtual int SetAdvanceParams(const char* key, const char* object) = 0;
	virtual const char* GetAdvanceParams(const char* key) = 0;

	virtual int StartRealTimeASR() = 0;

	virtual int StartRealTimeASR(const char* language) = 0;

	virtual int StopRealTimeASR() = 0;

	virtual int EnableAgeDectection(bool bEnable) = 0;

	virtual int InitAgeDectection(const char* strBinaryPath, const char* strParamPath) = 0;

    virtual ITMG_CHECK_MIC_STATUS CheckMic() = 0;

    virtual ITMG_RECORD_PERMISSION CheckMicPermission() = 0;

    virtual int InitFaceTracker(const char* license, const char* secretKey) = 0;

    virtual ITMGFaceTracker * CreateFaceTracker(const char* modelDirPath, const char* configFileName) = 0;

    virtual ITMGFaceRenderer * CreateFaceRenderer(const char* assetPath, const char *configFileName) = 0;

	virtual ITMGPoseTracker * CreatePoseTracker(const char* bodyModelPath, const char *bodyModelBinPath,
		const char* poseModelPath, const char *poseModelBinPath,
		const char* smootherModelPath, const char *smootherModelBinPath) = 0;
};

//////////////////////////////////////////////////////////////////////////
// TMG The whole callback
class ITMGDelegate {
public:
    virtual ~ITMGDelegate() {};
public:
	//EventType callback,you can search in ITMGContext.TMGDelegate
	//Data is a JSON string format under Windows platform, you can read more about key-value in Developer Manual
	//		[in]eventType -->	Event types
	//		[in]data	  -->	Detailed description of the event(json format),you can read more about data in Developer Manual

    virtual void OnEvent(ITMG_MAIN_EVENT_TYPE eventType, const char* data) = 0;
};

class ITMGRoom {
public:
	virtual ~ITMGRoom() {} ;

	// Get the quality tips,by this function you can check out SDK quality information.
	virtual const char* GetQualityTips() = 0;
	virtual int ChangeRoomType(ITMG_ROOM_TYPE roomType) = 0;
	virtual int GetRoomType() = 0;

	// Get the RoomID
	// pBuffer : the buffer that will carry the roomid
	// nLength : the total length of the pBuffer, should be the value [128-256]
	// return : the valid length of the roomid, max 128
	virtual int GetRoomID(char* pBuffer, int nLength) = 0;

	// range : if Spatializer is enabled or WorldMode is selected:
	//		user can't hear the speaker if the distance between them is larger than the range;
	//		by default, range = 0. which means without calling UpdateAudioRecvRange no audio would be available.
	virtual int UpdateAudioRecvRange(int range) = 0;

	virtual int UpdateSpatializerRecvRange(int range) = 0;

	// Tell Self's position and rotation information to GME for function: Spatializer && WorldMode
	// position and rotate should be under the world coordinate system specified by forward, rightward, upward direction.
	// for example: in Unreal(forward->X, rightward->Y, upward->Z); in Unity(forward->Z, rightward->X, upward->Y)
	// position: self's position
	// axisForward: the forward axis of self's camera rotation
	// axisRightward: the rightward axis of self's camera rotation
	// axisUpward: the upward axis of self's camera rotation
	virtual int UpdateSelfPosition(int position[3], float axisForward[3], float axisRightward[3], float axisUpward[3]) = 0;

	// Tell other's position
	virtual int UpdateOtherPosition(const char* openID, int position[3]) = 0;

    // targetRoomID : the room you want to join in
    // targetOpenID : the openid in the target room
    // authBuff: can be empty
    // buffLen : must be 0
    virtual int StartRoomSharing(const char* targetRoomID, const char* targetOpenID, const char* authBuff, int buffLen) = 0;

    // Stop room sharing
    virtual int StopRoomSharing() = 0;

	// roomID : the room you want to switch to
	// authBuff : Authentication code in Tencent Cloud
	// buffLen : String length of Authentication cod
	virtual int SwitchRoom(const char* roomID, const char* authBuff, int buffLen) = 0;

	virtual int SetServerAudioRoute(ITMG_SERVER_AUDIO_ROUTE_SEND_TYPE SendType, const char OpenIDforSend[][128], int OpenIDforSendSize, ITMG_SERVER_AUDIO_ROUTE_RECV_TYPE RecvType,const char OpenIDforRecv[][128], int OpenIDforRecvSize) = 0;

	virtual ITMG_SERVER_AUDIO_ROUTE_SEND_TYPE GetCurrentSendAudioRoute(char OpenIDforSend[][128], int &OpenIDforSendSize) = 0;
	virtual ITMG_SERVER_AUDIO_ROUTE_RECV_TYPE GetCurrentRecvAudioRoute(char OpenIDforRecv[][128], int &OpenIDforRecvSize) = 0;

	virtual int SendCustomData(const char *customdata, int length, int repeatCout) = 0;
	virtual int StopSendCustomData() = 0;

	virtual int StartChorusWithOpenID(const char *openid) = 0;
	virtual int StopChorus() = 0;
	virtual int StartChorusVocalAccompaniment(const char *openid) = 0;
	virtual int StopChorusVocalAccompaniment() = 0;

    virtual int SendCustomStreamData(const char* customstreamdata, int length) = 0;
    virtual int SetCustomStreamDataCallback(PFCustomStreamDataCallback callback, void* user_data) = 0;
};

//////////////////////////////////////////////////////////////////////////
//Audio control instances
class ITMGAudioCtrl {
public:
	class TMGAudioDeviceInfo
	{
	public:
		const char* pDeviceID;
		const char* pDeviceName;
	};
public:
	virtual ~ITMGAudioCtrl() {};

	// a recommended way of accessing microphone. EnableMic(value) = EnableAudioCaptureDevice(value) + EnableAudioSend(value)
	virtual int EnableMic(bool enable) = 0;
	// a shortcut of mic state [0 is off; 1 is on] = IsAudioSendEnabled() && IsAudioCaptureDeviceEnabled()
	virtual int GetMicState() = 0;

	// a recommended way of accessing speaker. EnableSpeaker(value) = EnableAudioPlayDevice(value) + EnableAudioRecv(value)
	virtual int EnableSpeaker(bool enable) = 0;
	// a shortcut of speaker state [0 is off; 1 is on] = IsAudioRecvEnabled() && IsAudioPlayDeviceEnabled()
	virtual int GetSpeakerState() = 0;

    // Enable Audio Device, GME won't automatically open capture and play devices unless you open it.
    // note: it can only be called when in room, ExitRoom will automatically close devices
    // note: when capture device is about to open in kinds of phones, Authority is needed and AudioCategory will change
    // note: if currently no device is available, GME will automatically retry until open successfully if Enable(true) is called
    //
    // Cases:
    //      1. when user click mic/speaker buttons:
    //          option 1: call EnableAudioCaptureDevice&&EnableAudioSend together when mic button clicked and EnableAudioPlayDevice&&EnableAudioRecv when speaker button clicked
	//			option 1 is recommended for most of game Apps.
    //          option 2: call EnableAudioCaptureDevice(true) && EnableAudioPlayDevice(true) just once(when enterRoom), just use EnableAudioSend/Recv to control stream.
	//			option 2 is recommended for some kind of social Apps
    //      2. if you want to release devices for other modules' usage, it's better to use PauseAudio/ResumeAudio.
    virtual int EnableAudioCaptureDevice(bool enable) = 0;
    virtual int EnableAudioPlayDevice(bool enable) = 0;

    // Get the state of microphone && speaker device
    virtual bool IsAudioCaptureDeviceEnabled() = 0;
    virtual bool IsAudioPlayDeviceEnabled() = 0;

	// Enable/Disable sending audio data, only take effect when capture device opened, @see EnableAudioCaptureDevice
	// ExitRoom will automatically call EnableAudioSend(false)
	virtual int EnableAudioSend(bool bEnable) = 0;
	// Enable/Disable receiving audio data, only take effect when player device opened, @see EnableAudioPlayDevice
	// ExitRoom will automatically call EnableAudioRecv(false)
	virtual int EnableAudioRecv(bool enable) = 0;

	// Get the state of sending audio data or receiving audio data
	virtual bool IsAudioSendEnabled() = 0;
	virtual bool IsAudioRecvEnabled() = 0;

	// Get the energy value of the selected microphone(For example, you can use the energy value for drawing an audio column diagram)
	virtual int GetMicLevel() = 0;

	// Set the volume of the microphone
	//		[in]volume--->Audio Volume reference range[0 to 200],default value is 100
	virtual int SetMicVolume(int vol)=0;

	// Get the volume of microphone
	virtual int GetMicVolume()=0;

	// Get the energy value of the selected speaker(For example,you can use the energy value for drawing an audio column diagram)
	virtual int GetSpeakerLevel() = 0;

	// Set the volume of the speaker
	//		[in]nVolume	-->	Audio Volume reference range[0 to 200],default value is 100
	virtual int SetSpeakerVolume(int vol) = 0;

	// Get the volume of speaker
	virtual int GetSpeakerVolume() = 0;

	// Set the openid's volume
	//		[in]openId	-->	The Speaker's id(Even the speaker is not speaking, openid will be recorded)
	//		[in]nVolume	-->	Audio Volume reference range[0 to 200],default value is 100
	virtual int SetSpeakerVolumeByOpenID(const char* openId, int vol) = 0;

	// Get the openid's volume
	//		[in]openId	-->	The Speaker's id
	virtual int GetSpeakerVolumeByOpenID(const char* openId) = 0;


    // Only available in Windows
    // Get the number of microphone devices
    //        [return]    Get the number of microphone devices
    virtual int GetMicListCount() = 0;

    // Only available in Windows
    // Get the list of microphone devices
    //        [in/out]ppDeviceInfoList---> The list of microphone devices that has been allocated memory
    //        [in]nCount---> The length of ppDeviceInfoList，you can get it by function GetMicListCount
    virtual int GetMicList(TMGAudioDeviceInfo* ppDeviceInfoList, int nCount) = 0;

	virtual int GetCurrentMic(TMGAudioDeviceInfo &DeviceInfo) = 0;
    // Only available in Windows
    // Select a microphone device
    virtual int SelectMic(const char* pMicID) = 0;

    // Only available in Windows
    // Get the number of speaker devices
    //        [return] -->The number of speaker devices
    virtual int GetSpeakerListCount() = 0;

    // Only available in Windows
    // Get the list of speaker devices, devices that has been allocated memory
    //        [in/out]ppDeviceInfoList --> the list of speaker devices, devices that has been allocated memory
    //        [in]nCount --> The length of ppDeviceInfoList，you can get it by function GetSpeakerListCount
    virtual int GetSpeakerList(TMGAudioDeviceInfo* ppDeviceInfoList, int nCount) = 0;


	virtual int GetCurrentSpeaker(TMGAudioDeviceInfo &DeviceInfo) = 0;
    // Only available in Windows
    // Select a speaker
    virtual int SelectSpeaker(const char* pSpeakerID) = 0;

	// Enable or disable monitor
	//		[in]bEnable	-->	Enable or disable ear back(listen self's voice)
	virtual int EnableLoopBack(bool enable) = 0;

	virtual int EnableMixSystemAudioToSend(bool enable) = 0;

	// Add An OpenId to BlackList to block his audio
	virtual int AddAudioBlackList(const char* openId) = 0;

	// Remove An OpenId from BlackList to let his audio pass
	virtual int RemoveAudioBlackList(const char* openId) = 0;

    // OpenId in BlackList
    virtual bool IsOpenIdInAudioBlackList(const char* openId) = 0;
    // Get the energy value of the near-end stream
    virtual int GetSendStreamLevel() = 0;

    // Get the energy value of a far-end stream, identified by openId
    virtual int GetRecvStreamLevel(const char* openId) = 0;

	// Init Spatializer, If you want to use EnableSpatializer, InitSpatializer should be called on both speaker and listener's client side
	virtual int InitSpatializer(const char* modelPath) = 0;

	// Enable or disable the spatial audio
	//[in]bEnable	--> Enable or disable the spatial audio
    //[in]applyTeam	--> indicates whether to use spatial audio in the same team or not
	// note: InitSpatializer should be called on both speaker and listener's client side
	virtual int EnableSpatializer(bool bEnable, bool applyTeam) = 0;

	// Get the current spatial audio state
	virtual bool IsEnableSpatializer() = 0;

	// Set recv limit num, must less that SetRecvMixStreamCount
	virtual int SetAudioMixCount(int nCount) = 0;

	virtual int AddSameTeamSpatializer(const char* openId) = 0;
	virtual int RemoveSameTeamSpatializer(const char* openId) = 0;

    virtual int AddSpatializerBlacklist(const char* openId) = 0;
    virtual int RemoveSpatializerBlacklist(const char* openId) = 0;
    virtual int ClearSpatializerBlacklist() = 0;

    // Check the status of iPhone's mute switch,only for iOS.
	virtual int CheckDeviceMuteState() = 0;

    // Trigger an active throw audio energy event
    // [in] trackingTimeS:trigger interval(s)
    virtual int TrackingVolume(float trackingTimeS) = 0;

    // Stop actively throwing audio energy events
    virtual int StopTrackingVolume() = 0;
};

class ITMGAudioEffectCtrl {
public:
    virtual ~ITMGAudioEffectCtrl(){};

    virtual int StartAccompany(const char* filePath, bool loopBack, int loopCount, int msTime) = 0;
    virtual int StopAccompany(int duckerTime) = 0;
    virtual bool IsAccompanyPlayEnd() = 0;
    virtual int EnableAccompanyPlay(bool enable) = 0;
    virtual int EnableAccompanyLoopBack(bool enable) = 0;

    virtual int PauseAccompany() = 0;
    virtual int ResumeAccompany() = 0;

    virtual int SetAccompanyVolume(int vol) = 0;
    virtual int GetAccompanyVolume() = 0;

    virtual int GetAccompanyFileTotalTimeByMs() = 0;
    virtual int GetAccompanyFileCurrentPlayedTimeByMs() = 0;
	virtual int GetAccompanyFileTotalTimeByMs(const char* openId) = 0;
	virtual int GetAccompanyFileCurrentPlayedTimeByMs(const char* openId) = 0;
    virtual int SetAccompanyFileCurrentPlayedTimeByMs(unsigned int time)  = 0;

    virtual int SetAccompanyKey(int nKey) = 0;
    virtual int SetVoiceType(ITMG_VOICE_TYPE voiceType) = 0;
	virtual int SetKaraokeType(ITMG_KARAOKE_TYPE type) = 0;
	virtual int SetKaraokeType(ITMG_VOICE_TYPE_EQUALIZER* pEqualizer, ITMG_VOICE_TYPE_REVERB* pReverb) = 0;

    virtual int GetEffectsVolume() = 0;
    virtual int SetEffectsVolume(int vol) = 0;

    virtual int GetEffectVolume(int soundId) = 0;
    virtual int SetEffectVolume(int soundId, int vol) = 0;

    virtual int PlayEffect(int soundId, const char* filePath, bool loop) = 0;
    virtual int PlayEffect(int soundId, const char* filePath, bool loop, double pitch, double pan, int vol) = 0;
    virtual int PauseEffect(int soundId) = 0;
    virtual int PauseAllEffects() = 0;
    virtual int ResumeEffect(int soundId) = 0;
    virtual int ResumeAllEffects() = 0;
    virtual int StopEffect(int soundId) = 0;
    virtual int StopAllEffects() = 0;
    virtual int EnableEffectSend(int soundId, bool enable) = 0;
    virtual int SetEffectFileCurrentPlayedTimeByMs(int soundId, unsigned int timeMs) = 0;
    virtual int GetEffectFileCurrentPlayedTimeByMs(int soundId) = 0;

    virtual int StartRecord(const char* filePath, int sampleRate, int channels, bool recordLocalMic, bool recordRemote, bool recordAccompany) = 0;
    virtual int StopRecord() = 0;
    virtual int PauseRecord() = 0;
    virtual int ResumeRecord() = 0;
    virtual int EnableRecordLocalMic(bool enable) = 0;
    virtual int EnableRecordAccompany(bool enable) = 0;
    virtual int EnableRecordRemote(bool enable) = 0;

	virtual int StartRecordForHardwareDelayTest() = 0;
	virtual int StopRecordForHardwareDelayTest() = 0;
	virtual int StartPreviewDelayTest() = 0;
	virtual int StopPreviewDelayTest() = 0;
	virtual int SetHardWareDelay(int delayinMS) = 0;
	virtual int GetHardWareDelay() = 0;

	virtual int InitVoiceChanger(const char* dataPath) = 0;
	virtual int FetchVoiceChangerList() = 0;
	virtual int SetVoiceChangerName(const char* voiceName) = 0;
	virtual const char* GetVoiceChangerParams() = 0;
	virtual float GetVoiceChangerParamValue(const char* paramName) = 0;
	virtual int SetVoiceChangerParamValue(const char* paramName, float paramValue) = 0;

};

class ITMGPTT{
public:
    virtual ~ITMGPTT(){};

	virtual int ApplyPTTAuthbuffer(const char* authBuffer, int authBufferLen) = 0;
    virtual int SetMaxMessageLength(int msTime)= 0;

    virtual int StartRecording(const char* filePath)= 0;
    virtual int StopRecording() = 0;
    virtual int CancelRecording()= 0;

    virtual int UploadRecordedFile(const char* filePath) = 0;
    virtual int DownloadRecordedFile(const char* fileId, const char* filePath) = 0;

    virtual int PlayRecordedFile(const char* filePath) = 0;
	virtual int PlayRecordedFile(const char* filePath, ITMG_VOICE_TYPE voiceType) = 0;
    virtual int StopPlayFile() = 0;

    virtual int GetMicLevel() = 0;
    virtual int SetMicVolume(int vol) = 0;
    virtual int GetMicVolume() = 0;

    virtual int GetSpeakerLevel() = 0;
    virtual int SetSpeakerVolume(int vol) = 0;
    virtual int GetSpeakerVolume() = 0;

    virtual int SpeechToText(const char* fileID) = 0;
    virtual int SpeechToText(const char* fileID,const char* speechLanguage) = 0;
	virtual int SpeechToText(const char* fileID,const char* speechLanguage,const char* translateLanguage) = 0;

    virtual int TranslateText(const char* text, const char* sourceLanguage, const char* translateLanguage) = 0;

    virtual int GetFileSize(const char* filePath) = 0;
    virtual int GetVoiceFileDuration(const char* filePath) = 0;

    virtual int StartRecordingWithStreamingRecognition(const char* filePath) = 0;
	virtual int StartRecordingWithStreamingRecognition(const char* filePath,const char*speechLanguage) = 0;
    virtual int StartRecordingWithStreamingRecognition(const char* filePath,const char*speechLanguage,const char*translateLanguage) = 0;

	virtual int PauseRecording() = 0;
	virtual int ResumeRecording() = 0;

    virtual int SetPTTSourceLanguage(const char* sourceLanguage) = 0;
    virtual int TextToSpeech(const char* text, const char* voiceName,
        const char* languageCode, float speakingRate) = 0;
};

class ITMGRoomManager {
 public:
    virtual ~ITMGRoomManager() {}

    int virtual EnableMic(bool enable,const char *receiverID) = 0;
    int virtual EnableSpeaker(bool enable,const char *receiverID) = 0;

    virtual int EnableAudioCaptureDevice(bool enable,const char *receiverID) = 0;
    virtual int EnableAudioPlayDevice(bool enable,const char *receiverID) = 0;

    virtual int EnableAudioSend(bool bEnable,const char *receiverID) = 0;
    virtual int EnableAudioRecv(bool enable,const char *receiverID) = 0;

    virtual int GetMicState(const char *receiverID) = 0;
    virtual int GetSpeakerState(const char *receiverID) = 0;

    virtual int ForbidUserOperation(bool enable, const char *receiverID) = 0;
};

class ITMGFaceTracker {
 public:
    virtual ~ITMGFaceTracker() {}

 public:
    virtual int Destroy() = 0;
    virtual int Reset() = 0;

    virtual int GetParam(TMGFaceTrackerParam *param) = 0;
    virtual int SetParam(const TMGFaceTrackerParam *param) = 0;

    virtual int TrackFace(unsigned char *imageData, ITMG_IMG_FORMAT imageFormat, int width, int height, int stride,
                           ITMG_IMG_ORIENTATION orientation, TMGFaceTrackerFaceInfo **trackedFace, int *trackedCount) = 0;
    virtual void ReleaseTrackedFace(TMGFaceTrackerFaceInfo *trackedFace) = 0;
};

class ITMGFaceRenderer {
 public:
    virtual ~ITMGFaceRenderer() {}

 public:
    virtual int Destroy() = 0;

    virtual int RenderFace(unsigned char * dst, unsigned char * src, ITMG_IMG_FORMAT imageFormat, int width, int height,
                       ITMG_IMG_ORIENTATION orientation, const TMGFaceTrackerFaceInfo *face, int faceCount) = 0;
};

class ITMGPoseTracker {
public:
	virtual ~ITMGPoseTracker() {}

public:
	virtual int Destroy() = 0;
	virtual int SetRenderEngine(const char* engine) = 0;
	virtual int TrackPose(unsigned char *imageData, ITMG_IMG_FORMAT imageFormat, int width, int height, int stride,
		ITMG_IMG_ORIENTATION orientation, TMGPoseTrackerPoseInfo *trackedFace) = 0;
};
