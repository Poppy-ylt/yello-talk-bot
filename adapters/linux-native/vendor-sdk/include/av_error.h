#pragma once
#include "av_type.h"
// For details about error codes, see：
// Chinese: https://cloud.tencent.com/document/product/607/15173
// English: https://www.tencentcloud.com/document/product/607/33223
namespace nsgme {
namespace av {
const int AV_OK = 0;
//const int ERR_FAIL = 0x1;
//If you need to handle all error codes uniformly, please use !AV_OK.
//If you need to handle each type of error separately, please pay attention to the type of error code returned by the interface.
const int AV_ERR_REPETITIVE_OPERATION = 1001;
static const char AV_ERR_INFO_REPETITIVE_OPERATION[] = "repetitive operation";
const int AV_ERR_EXCLUSIVE_OPERATION = 1002;
static const char AV_ERR_EXCLUSIVE_OPERATION_INFO[] = "exclusive operation";
const int AV_ERR_HAS_IN_THE_STATE = 1003;
static const char AV_ERR_HAS_IN_THE_STATE_INFO[] = "just in the state";
const int AV_ERR_INVALID_ARGUMENT = 1004;
static const char AV_ERR_INVALID_ARGUMENT_INFO[] = "invalid argument";
const int AV_ERR_TIMEOUT = 1005;
static const char AV_ERR_TIMEOUT_INFO[] = "waiting timeout, please check your network";
const int AV_ERR_NOT_IMPLEMENTED = 1006;
static const char AV_ERR_NOT_IMPLEMENTED_INFO[] = "function not implemented";
const int AV_ERR_NOT_ON_MAIN_THREAD = 1007;
static const char AV_ERR_INFO_NOT_ON_MAIN_THREAD[] = "not on the main thread";
const int  AV_ERR_CONTEXT_NOT_START = 1101;
static const char AV_ERR_INFO_CONTEXT_NOT_START[] = "AVContext did not start";
const int  AV_ERR_ROOM_NOT_EXIST = 1201;
static const char AV_ERR_ROOM_NOT_EXIST_INFO[] = "room not exist";
const int  AV_ERR_ROOM_NOT_EXITED = 1202;
static const char AV_ERR_ROOM_NOT_EXITED_INFO[] = "room not exited";
const int  AV_ERR_DEVICE_NOT_EXIST = 1301;
static const char AV_ERR_DEVICE_NOT_EXIST_INFO[] = "device not exist";
const int  AV_ERR_SERVER_FAIL = 10001;
static const char AV_ERR_SERVER_FAIL_INFO[] = "server response error";
const int  AV_ERR_SERVER_NO_PERMISSION = 10003;
static const char AV_ERR_SERVER_NO_PERMISSION_INFO[] = "server refused because of no permission";
const int  AV_ERR_SERVER_REQUEST_ROOM_ADDRESS_FAIL = 10004;
static const char AV_ERR_SERVER_REQUEST_ROOM_ADDRESS_FAIL_INFO[] = "request room server address failed";
const int  AV_ERR_SERVER_CONNECT_ROOM_FAIL = 10005;
static const char AV_ERR_SERVER_CONNECT_ROOM_FAIL_INFO[] = "connect room server response error, mostly arguments wrong.";
const int  AV_ERR_SERVER_ROOM_DISSOLVED = 10007;
static const char AV_ERR_SERVER_ROOM_DISSOLVED_INFO[] = "room dissolved because of overuse";
const int  AV_ERR_IMSDK_FAIL  = 6999;
static const char AV_ERR_IMSDK_FAIL_INFO[] = "imsdk return failed";
const int  AV_ERR_IMSDK_TIMEOUT  = 7000;
static const char AV_ERR_IMSDK_TIMEOUT_INFO[] = "imsdk waiting timeout";
const int  AV_ERR_HTTP_REQ_FAIL  = 7001;
static const char AV_ERR_HTTP_REQ_FAIL_INFO[] = "http request failed";

const int AV_ERR_3DVOICE_ERR_FILE_DAMAGED     = 7002;//3d voice model file is damaged.
const int AV_ERR_3DVOICE_ERR_NOT_INITED       = 7003;//should call InitSpatializer first

const int AV_ERR_NET_REQUEST_FALLED = 7004;
const int AV_ERR_CHARGE_OVERDUE     = 7005;
const int AV_ERR_AUTH_FIALD         = 7006;
const int AV_ERR_IN_OTHER_ROOM      = 7007;
const int AV_ERR_DISSOLVED_OVERUSER = 7008;
const int AV_ERR_NO_PERMISSION      = 7009;
const int AV_ERR_FILE_CANNOT_ACCESS = 7010;
const int AV_ERR_FILE_DAMAGED       = 7011;
const int AV_ERR_SERVICE_NOT_OPENED = 7012;
const int AV_ERR_USER_CANCELED      = 7013;
const int AV_ERR_LOAD_LIB_FAILED    = 7014;
const int AV_ERR_SDK_NOT_FULL_UPDATE = 7015;  //During the upgrade of SDK, not all files were updated, resulting in mismatch of some modules
const int AV_ERR_ROOMMANAGER_TIMESTAMP_CHECK_FAIL = 7016;
const int AV_ERR_ASR_CONNECT_CLOSED = 7017;
const int AV_ERR_MUTESWITCH_DECTECT_ERR = 7018;// iOS mute switch detecteded error
const int AV_ERR_DB_ERROR           = 7019;    // Database error
const int AV_ERR_SYSTEM_INTERNAL_ERROR = 7020; // Internal system error
const int AV_ERR_INVALID_REQ        = 7021;    // Invalid request
const int AV_ERR_BUS_ERROR          = 7022;    // Services are not supported or are not activated

/*
 ---------------------------------------------------------------------------------------
 @name Errors related to real-time voice accompaniment
---------------------------------------------------------------------------------------
 */
const int AV_ERR_ACC_OPENFILE_FAILED                 = 4001;        ///< Failed to open file
const int AV_ERR_ACC_FILE_FORAMT_NOTSUPPORT          = 4002;        ///< Unsupported file format
const int AV_ERR_ACC_DECODER_FAILED                  = 4003;        ///< Decoding failure
const int AV_ERR_ACC_BAD_PARAM                       = 4004;       ///<  Parameter error
const int AV_ERR_ACC_MEMORY_ALLOC_FAILED             = 4005;       ///<  Memory allocation failure
const int AV_ERR_ACC_CREATE_THREAD_FAILED            = 4006;        ///< Thread creation failure
const int AV_ERR_ACC_STATE_ILLIGAL                   = 4007;        ///< Illegal statement
const int AV_ERR_START_ACC_FIRST                     = 4008;        ///< Accompaniment is required to be opened before the delay recording of device acquisition and playback
const int AV_ERR_START_ACC_IS_STARTED                = 4009;        ///< Accompaniment is required to be stopped before the delay recording of device acquisition and playback
const int AV_ERR_HARDWARE_TEST_RECORD_IS_STARTED     = 4010;        ///< Recording is required to be stopped before the delay previewing of device acquisition and playback
const int AV_ERR_HARDWARE_TEST_PREVIEW_IS_STARTED    = 4011;        ///< Preivew is required to be stopped before the delay recording of device acquisition and playback
const int AV_ERR_HARDWARE_TEST_PREVIEW_DATA_IS_EMPTY = 4012;        ///< Preivew is required to be stopped before the delay recording of device acquisition and playback


/*
---------------------------------------------------------------------------------------
 @name Errors related to real-time audio
---------------------------------------------------------------------------------------
*/
const int AV_ERR_EFFECT_OPENFILE_FAILED         = 4051;        ///< Failed to open file
const int AV_ERR_EFFECT_FILE_FORAMT_NOTSUPPORT  = 4052;        ///< Unsupported file format
const int AV_ERR_EFFECT_DECODER_FAILED          = 4053;        ///< Decoding failure
const int AV_ERR_EFFECT_BAD_PARAM               = 4054;       ///< Parameter error
const int AV_ERR_EFFECT_MEMORY_ALLOC_FAILED     = 4055;       ///< Memory allocation failure
const int AV_ERR_EFFECT_CREATE_THREAD_FAILED    = 4056;        ///< Thread creation failure
const int AV_ERR_EFFECT_STATE_ILLIGAL           = 4057;        ///< Illegal statement

/*
---------------------------------------------------------------------------------------
@name Errors related to real-time voice recording
---------------------------------------------------------------------------------------
*/
const int AV_ERR_RECORD_OPENFILE_FAILED = 5001;        ///< Failed to open file
const int AV_ERR_RECORD_FILE_FORAMT_NOTSUPPORT = 5002;        ///< Unsupported file format
const int AV_ERR_RECORD_DECODER_FAILED = 5003;        ///< Decoding failure
const int AV_ERR_RECORD_BAD_PARAM = 5004;       ///< Parameter error
const int AV_ERR_RECORD_MEMORY_ALLOC_FAILED = 5005;       ///< Memory allocation failure
const int AV_ERR_RECORD_CREATE_THREAD_FAILED = 5006;        ///< Thread creation failure
const int AV_ERR_RECORD_STATE_ILLIGAL = 5007;        ///< Illegal statement


const int AV_ERR_SYSTEM_AUDIO_HOOK_NOT_FIND_DRIVER = 6002;
const int AV_ERR_SYSTEM_AUDIO_HOOK_PRIVILEGEDTASK_LOAD_FAILED = 6003;
const int AV_ERR_SYSTEM_AUDIO_HOOK_NEED_RESTART_APP = 6004;
const int AV_ERR_SYSTEM_AUDIO_HOOK_SYSTEM_ERROR = 6005;
const int AV_ERR_SYSTEM_AUDIO_HOOK_DRIVER_INSTALL_FAILED = 6006;


const int AV_ERR_UNKNOWN = 65536;
static const char AV_ERR_INFO_UNKNOWN[] = "unknown error";


const int  VOICE_RECORDER_PARAM_NULL                    = 0x1001;
const int  VOICE_RECORDER_INIT_ERROR                    = 0x1002;
const int  VOICE_RECORDER_RECORDING_ERROR               = 0x1003;
const int  VOICE_RECORDER_NO_AUDIO_DATA_WARN            = 0x1004;
const int  VOICE_RECORDER_OPENFILE_ERROR                = 0x1005;
const int  VOICE_RECORDER_MIC_PERMISSION_ERROR          = 0x1006;
const int  VOICE_RECORD_AUDIO_TOO_SHORT					= 0x1007;
const int  VOICE_RECORD_NOT_START				    	= 0x1008;


const int VOICE_UPLOAD_FILE_ACCESSERROR       = 0x2001; //File reading error
const int VOICE_UPLOAD_SIGN_CHECK_FAIL        = 0x2002; //Authentication failure
const int VOICE_UPLOAD_COS_INTERNAL_FAIL       = 0x2003; //Upload to cos failed
const int VOICE_UPLOAD_GET_TOKEN_NETWORK_FAIL = 0x2004; // Network error while accessing the service server
const int VOICE_UPLOAD_SYSTEM_INNER_ERROR     = 0x2005; //Server internal error
const int VOICE_UPLOAD_RSP_DATA_DECODE_FAIL   = 0x2006; //Parsing json failed
const int VOICE_UPLOAD_APPINFO_UNSET          = 0x2008; //Ptt authbuffer not set
//const int VOICE_UPLOAD_NETWORK_FAIL           = 0x2003; deprecated
//const int VOICE_UPLOAD_GET_TOKEN_RESP_NULL    = 0x2005;deprecated
//const int VOICE_UPLOAD_GET_TOKEN_RESP_INVALID = 0x2006;deprecated
//const int VOICE_UPLOAD_TOKEN_CHECK_EXPIRED    = 0x2007;deprecated

const int VOICE_DOWNLOAD_FILE_ACCESS_ERROR             = 0x3001;       //12289 File write failure
const int VOICE_DOWNLOAD_SIGN_CHECK_FAIL               = 0x3002;       //12290 Token signature verification failed. You can try to obtain the token again
const int VOICE_DOWNLOAD_COS_INTERNAL_FAIL             = 0x3003;       //12291 The COS storage system fails/Access to the COS network times out
const int VOICE_DOWNLOAD_REMOTEFILE_ACCESS_ERROR       = 0x3004;       //12292 Access to cos failed
const int VOICE_DOWNLOAD_GET_SIGN_NETWORK_FAIL         = 0x3005;       //12293 The http network failed while obtaining download parameters
const int VOICE_DOWNLOAD_SYSTEM_INNER_ERROR            = 0x3006;	 //Server internal error
const int VOICE_DOWNLOAD_GET_SIGN_RSP_DATA_DECODE_FAIL = 0x3007;       //12295 Failed to unpack when obtaining download parameters
const int VOICE_DOWNLOAD_APPINFO_UNSET                 = 0x3009;       //12297 App info unset
//const int VOICE_DOWNLOAD_GET_SIGN_RSP_DATA_NULL        = 0x3006;  deprecated
//const int VOICE_DOWNLOAD_SIGN_CHECK_EXPIRED            = 0x3008;  deprecated

const int VOICE_PLAY_INIT_ERROR      = 0x5001; //Internal errors such as player initialization errors, decoding failures, etc. Specific reason needs to be located with the GME log
const int VOICE_PLAY_PLAYING_ERROR   = 0x5002; //
const int VOICE_PLAY_PARAM_NULL      = 0x5003; //Parameter is null
const int VOICE_PLAY_OPEN_FILE_ERROR = 0x5004; //Failed to open the audio file.
const int VOICE_PLAY_NOT_START 	   = 0x5005; //The audio does not start playing
const int VOICE_PLAYER_SILKFILE_NULL = 0x5006; //The audio playback file is empty
const int VOICE_PLAYER_SILKFILE_READ_ERROR = 0x5007; //Failed to read the audio file
const int VOICE_PLAYER_INIT_DEVICE_ERROR = 0x5008; //Device initialization failed
const int VOICE_PLAYER_ERROR = 0x5009; //Playback failure or Internal system error, such as thread creation, memory request/release error

const int VOICE_ERR_VOICE_S2T_SYSTEM_INTERNAL_ERROR       			     = 0x8001; // INNER ERROR
const int VOICE_ERR_VOICE_S2T_NETWORK_FAIL						         = 0x8002;
const int VOICE_ERR_VOICE_S2T_RSP_DATA_DECODE_FAIL  					 = 0x8004; // unpack error
const int VOICE_ERR_VOICE_S2T_APPINFO_UNSET         					 = 0x8006; // Appinfo not set
const int VOICE_ERR_VOICE_STREAMIN_RECORD_SUC_REC_FAIL			         = 0x8007; // Failed while Uploading, but recorded success
const int VOICE_ERR_VOICE_S2T_SIGN_CHECK_FAIL					         = 0x8008; // AuthBuffer Check Failed
const int VOICE_ERR_VOICE_STREAMIN_UPLOADANDRECORD_SUC_REC_FAIL          = 0x8009; // Failed while converting, but uploaded and recorded
const int VOICE_ERR_VOICE_S2T_PARAM_NULL                                 = 0x8010; //file ID is NULL
const int VOICE_ERR_VOICE_S2T_AUTO_SPEECH_REC_ERROR                      = 0x8011; //AudioFileDecode error,asr error,http param error.For example, TexttoSpeech transfer succeeds but text translation fails
const int VOICE_ERR_VOICE_STREAMIN_RUNING_ERROR                          = 0x8012;  //
const int VOICE_ERR_VOICE_S2T_TRNSLATE_SERVICE_NOT_AVALIABLE             = 0x8013; //Translate function service not avaliable
const int VOICE_ERR_VOICE_S2T_TRNSLATE_LANGUAGE_NOT_SUPPORTED            = 0x8014; //Translate language not supported
const int VOICE_ERR_VOICE_S2T_TRNSLATE_FILEID_NOT_EXIST                  = 0x8015; //File ID not exist

const int VOICE_ERR_VOICE_STREAMING_ASR_ERROR                             = 50012; //asr error


const int AV_ERR_SHARE_ROOM                     = 700000;
const int AV_ERR_SHARE_ROOM_NORMAL              = 700001;
const int AV_ERR_SHARE_ROOM_NO_SPACE            = 700002;
const int AV_ERR_SHARE_ROOM_BUF_NOT_ENOUGH      = 700003;
const int AV_ERR_SHARE_ROOM_INVALID_VALUE       = 700004;
const int AV_ERR_SHARE_ROOM_NULL_POINT          = 700005;
const int AV_ERR_SHARE_ROOM_FULL_ROOM           = 700006;
const int AV_ERR_SHARE_ROOM_FULL_USER           = 700007;
const int AV_ERR_SHARE_ROOM_TIMEOUT             = 700008;
const int AV_ERR_SHARE_ROOM_REPEAT              = 700009;
const int AV_ERR_SHARE_ROOM_NO_ROOM             = 700010;
const int AV_ERR_SHARE_ROOM_NO_USER             = 700011;
const int AV_ERR_SHARE_ROOM_INVALID_KEY         = 700012;
const int AV_ERR_SHARE_ROOM_INVALID_ABILITY     = 700013;
const int AV_ERR_SHARE_ROOM_NO_PRIV             = 700014;
const int AV_ERR_SHARE_ROOM_PPT_FULL            = 700015;
const int AV_ERR_SHARE_ROOM_TYPE_ERR            = 700016;
const int AV_ERR_SHARE_ROOM_PB_SERIALIZE_ERR    = 700017;
const int AV_ERR_SHARE_ROOM_PB_PARSE_ERR        = 700018;
const int AV_ERR_SHARE_ROOM_OUT_MAX_ROOM_USER   = 700019;
const int AV_ERR_SHARE_ROOM_PB_NOT_BODY_ERR     = 700020;
const int AV_ERR_SHARE_ROOM_UIN                 = 700021;
const int AV_ERR_SHARE_ROOM_NEED_REDIRECT       = 700100;
const int AV_ERR_SHARE_ROOM_PROTOCOL_CHK_ERROR  = 710001;
const int AV_ERR_SHARE_ROOM_PROTOCOL_ERROR      = 710002;
const int AV_ERR_SHARE_ROOM_APPID_ERROR         = 710003;
const int AV_ERR_SHARE_ROOM_SEARCH_ERROR        = 710004;
const int AV_ERR_SHARE_ROOM_SEARCH_VIA_ERROR    = 710005;
const int AV_ERR_SHARE_ROOM_SEARCH_SEARCH_ERROR = 710006;

const int AV_ERR_CHORUS_OPENID_DO_NOT_MATCH = 720000;
const int AV_ERR_CHORUS_WRONG_STATUS = 720001;

const int AV_ERR_AGE_DETECTED_SUCCESS_USER_CHILD = 730000;
const int AV_ERR_AGE_DETECTED_SUCCESS_USER_ADULT = 730001;
const int AV_ERR_AGE_DETECTED_SUCCESS_USER_TEENAGER = 730002;
const int AV_ERR_AGE_DETECTED_INTERNAL_ERROR = 730003;
const int AV_ERR_AGE_DETECTED_USER_SILENCE = 730004;

const int AV_ERR_VOICE_NOT_INIT = 740000;
const int AV_ERR_VOICE_NOT_SET = 740001;
const int AV_ERR_VOICE_INIT_FAIL = 740002;
const int AV_ERR_VOICE_CALL_FAIL = 740003;
const int AV_ERR_VOICE_LOAD_FAIL = 740004;

const int AV_ERR_FACE_TRACKER_LOAD_FAIL = 740010;
const int AV_ERR_FACE_TRACKER_INIT_FAIL = 740011;
const int AV_ERR_FACE_TRACKER_CREATE_FAIL = 740012;
const int AV_ERR_FACE_TRACKER_NOT_ON_CREATE_THREAD = 740013;

const int AV_ERR_FACE_RENDERER_LOAD_FAIL = 740020;
const int AV_ERR_FACE_RENDERER_CREATE_FAIL = 740021;
const int AV_ERR_FACE_RENDERER_NOT_ON_CREATE_THREAD = 740022;

const int AV_ERR_POSE_TRACKER_LOAD_FAIL = 740030;
const int AV_ERR_POSE_TRACKER_CREATE_FAIL = 740031;

// const int VOICE_ERR_VOICE_V2T_SIGN_CHECK_FAIL          = 0x8008;  deprecated
} // namespace av
} // namespace nsgme

//If GMESDK_VERSION_xxx is not found, not all files are upgraded during the sdk upgrade. In this case, please upgrade the SDK in full
static const char* AV_TYPE_VERSION __UNUSED = GMESDK_VERSION_2_9_15_6fa587cb;
