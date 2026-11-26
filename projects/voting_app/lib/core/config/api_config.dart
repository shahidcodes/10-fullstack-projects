class ApiConfig {
  ApiConfig._();

  // Android Emulator
  static const String baseUrl = 'http://192.168.31.47:5000/api/v1';

  // API endpoints
  static const String register = '/auth/register';
  static const String login = '/auth/login';
  static const String refresh = '/auth/refresh';
  static const String logout = '/auth/logout';
  static const String me = '/auth/me';
  static const String elections = '/elections';
  static String electionDetails(String electionId) => '/elections/$electionId';
  static const Duration connectTimeout = Duration(seconds: 15);
  static const Duration receiveTimeout = Duration(seconds: 15);
  static const Duration sendTimeout = Duration(seconds: 15);
}
